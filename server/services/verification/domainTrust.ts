/**
 * A rough heuristic, not an authoritative domain-authority score (no real
 * data source like Moz/Ahrefs is wired in here). Deliberately coarse tiers
 * rather than fake-precise decimals (e.g. "0.847") that would imply more
 * confidence than this actually has.
 */
const HIGH_TRUST_SUFFIXES = [".gov", ".edu"];
const HIGH_TRUST_DOMAINS = new Set([
  "wikipedia.org",
  "nature.com",
  "science.org",
  "arxiv.org",
  "who.int",
  "un.org",
]);
const LOW_TRUST_DOMAINS = new Set(["reddit.com", "quora.com", "pinterest.com"]);

export type TrustTier = "high" | "medium" | "low";

export function domainTrustTier(url: string): TrustTier {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "low";
  }

  if (HIGH_TRUST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return "high";
  if (HIGH_TRUST_DOMAINS.has(hostname)) return "high";
  if (LOW_TRUST_DOMAINS.has(hostname)) return "low";
  return "medium";
}
