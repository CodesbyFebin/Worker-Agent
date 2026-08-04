export async function fetchPageText(url: string, maxChars = 6000): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WorkerAgentCloud-ResearchBot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Fetch failed (${response.status}) for ${url}`);

  const html = await response.text();

  // Heuristic extraction: strip script/style blocks, then all remaining
  // tags, then collapse whitespace. This is NOT a real readability parser —
  // it won't handle JS-rendered content, and can pull in nav/footer noise
  // on poorly-structured pages. Good enough for a first pass; swap in a
  // real extractor (e.g. Mozilla Readability) before relying on this for
  // anything precision-sensitive.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, maxChars);
}
