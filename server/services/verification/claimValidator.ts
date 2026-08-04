import { completeJSON } from "../../_core/llm";

export interface ExtractedClaim {
  claimText: string;
  /** 0-1 model self-estimate; a real Phase 2 build should cross-check this against researchProtocol.ts sources, not trust the model alone. */
  confidenceScore: number;
}

const SYSTEM_PROMPT = `You extract discrete, checkable factual claims from marketing/
video copy (e.g. "the platform supports UPI payments"). Ignore subjective or
promotional language ("game-changing", "the best"). Only list claims that
assert a specific, verifiable fact.`;

export async function extractClaims(text: string): Promise<ExtractedClaim[]> {
  const result = await completeJSON<{ claims: ExtractedClaim[] }>({
    system: SYSTEM_PROMPT,
    prompt: `Text:\n"""\n${text}\n"""\n\nReturn JSON: { "claims": [{ "claimText": string, "confidenceScore": number }] }. Empty array if there are no checkable factual claims.`,
    maxTokens: 800,
  });
  return result.claims ?? [];
}
