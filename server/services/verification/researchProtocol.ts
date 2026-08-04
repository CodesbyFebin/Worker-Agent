import { completeJSON } from "../../_core/llm";
import { webSearch } from "../search";
import { fetchPageText } from "./pageFetcher";
import { domainTrustTier, type TrustTier } from "./domainTrust";
import type { ClaimVerificationStatus } from "../../../shared/types";

export interface SupportingSentence {
  sourceUrl: string;
  sentence: string;
  relevanceScore: number;
}

export interface ClaimVerificationResult {
  status: ClaimVerificationStatus;
  confidence: number;
  supportingSentences: SupportingSentence[];
  contradictingSources: string[];
  topSourceUrl: string | null;
  notes: string;
}

const SOURCES_TO_FETCH = 5;

const SUPPORT_SYSTEM_PROMPT = `You check whether a specific factual claim is supported by a
piece of text. Return only sentences from the text that directly support
the claim — not tangentially related content. Be conservative: if nothing
in the text actually supports the claim, return an empty array.`;

const CONTRADICTION_SYSTEM_PROMPT = `You check whether a piece of text contradicts a specific
factual claim. Answer strictly "yes" or "no" — "yes" only if the text
directly conflicts with the claim, not just discusses a related topic.`;

async function findSupportingSentences(
  claim: string,
  sourceUrl: string,
  pageText: string,
): Promise<SupportingSentence[]> {
  const { sentences } = await completeJSON<{ sentences: Array<{ sentence: string; relevanceScore: number }> }>({
    system: SUPPORT_SYSTEM_PROMPT,
    prompt: `Claim: "${claim}"\n\nText:\n"""\n${pageText}\n"""\n\nReturn JSON: { "sentences": [{ "sentence": string, "relevanceScore": number }] } — empty array if nothing supports the claim.`,
    maxTokens: 500,
  });
  return (sentences ?? []).map((s) => ({ ...s, sourceUrl }));
}

async function contradicts(claim: string, pageText: string): Promise<boolean> {
  const answer = await completeJSON<{ contradicts: boolean }>({
    system: CONTRADICTION_SYSTEM_PROMPT,
    prompt: `Claim: "${claim}"\n\nText:\n"""\n${pageText}\n"""\n\nReturn JSON: { "contradicts": boolean }`,
    maxTokens: 100,
  });
  return answer.contradicts === true;
}

function trustWeight(tier: TrustTier): number {
  return tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.3;
}

/**
 * Real end-to-end verification: fan out a web search, fetch actual page
 * content for the top results, ask the LLM to find genuinely supporting
 * sentences (and separately, contradictions) in each, then combine those
 * signals with a coarse domain-trust weighting into a confidence score.
 *
 * This replaces mock source discovery entirely — every source here is a
 * real fetched URL, not a fabricated placeholder. That said: page-text
 * extraction is a regex heuristic (see pageFetcher.ts), domain trust is a
 * coarse 3-tier heuristic (see domainTrust.ts), and paywalled/JS-rendered
 * pages will often fail to fetch meaningfully — treat confidence scores as
 * a useful signal for triage, not a certified fact-check.
 */
export async function verifyClaim(claim: string): Promise<ClaimVerificationResult> {
  const searchResults = await webSearch(claim, SOURCES_TO_FETCH * 2);
  if (searchResults.length === 0) {
    return {
      status: "unverifiable",
      confidence: 0,
      supportingSentences: [],
      contradictingSources: [],
      topSourceUrl: null,
      notes: "No search results returned for this claim.",
    };
  }

  const candidates = searchResults.slice(0, SOURCES_TO_FETCH);
  const supportingSentences: SupportingSentence[] = [];
  const contradictingSources: string[] = [];
  const fetchErrors: string[] = [];

  for (const source of candidates) {
    let pageText: string;
    try {
      pageText = await fetchPageText(source.url);
    } catch (err) {
      fetchErrors.push(`${source.url}: ${(err as Error).message}`);
      continue; // unreachable/paywalled source — skip, don't fail the whole verification
    }
    if (!pageText) continue;

    const [supports, isContradiction] = await Promise.all([
      findSupportingSentences(claim, source.url, pageText),
      contradicts(claim, pageText),
    ]);

    supportingSentences.push(...supports);
    if (isContradiction) contradictingSources.push(source.url);
  }

  if (contradictingSources.length > 0) {
    return {
      status: "rejected",
      confidence: 0.2,
      supportingSentences,
      contradictingSources,
      topSourceUrl: contradictingSources[0],
      notes: `${contradictingSources.length} source(s) directly contradict this claim.`,
    };
  }

  if (supportingSentences.length === 0) {
    return {
      status: "unverifiable",
      confidence: 0.1,
      supportingSentences: [],
      contradictingSources: [],
      topSourceUrl: null,
      notes:
        fetchErrors.length === candidates.length
          ? `Could not fetch any of the ${candidates.length} candidate sources (paywalled, blocked, or JS-rendered).`
          : "Fetched sources did not contain supporting evidence for this claim.",
    };
  }

  // Weight each supporting sentence's relevance by the trust tier of its source.
  const weighted = supportingSentences.map((s) => ({
    ...s,
    weightedScore: s.relevanceScore * trustWeight(domainTrustTier(s.sourceUrl)),
  }));
  const confidence = Math.min(
    1,
    weighted.reduce((sum, s) => sum + s.weightedScore, 0) / weighted.length + Math.min(0.2, weighted.length * 0.05),
  );

  const topSource = [...weighted].sort((a, b) => b.weightedScore - a.weightedScore)[0];

  return {
    status: confidence >= 0.6 ? "verified" : "unverifiable",
    confidence,
    supportingSentences,
    contradictingSources: [],
    topSourceUrl: topSource?.sourceUrl ?? null,
    notes: `${supportingSentences.length} supporting sentence(s) found across ${candidates.length - fetchErrors.length} fetched source(s).`,
  };
}
