import { tavilySearch } from "./tavily";
import { braveSearch } from "./brave";
import { serperSearch } from "./serper";
import { env } from "../../_core/env";
import type { WebSearchResult, SearchProvider } from "./types";

const PROVIDERS: SearchProvider[] = [tavilySearch, braveSearch, serperSearch];

function configuredProviderCount(): number {
  return [env.TAVILY_API_KEY, env.BRAVE_SEARCH_API_KEY, env.SERPER_API_KEY].filter(Boolean).length;
}

/**
 * Fans out to every configured provider in parallel, merges, and dedupes by
 * URL. A provider with no API key configured returns [] rather than
 * throwing, so this works with just one key set — but if NONE are
 * configured, it throws clearly rather than silently returning no sources
 * (which would let a claim look "unverifiable" for lack of research effort
 * rather than lack of evidence).
 */
export async function webSearch(query: string, maxResults = 8): Promise<WebSearchResult[]> {
  if (configuredProviderCount() === 0) {
    throw new Error(
      "No search provider configured — set at least one of TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, SERPER_API_KEY",
    );
  }

  const settled = await Promise.allSettled(PROVIDERS.map((p) => p(query, maxResults)));
  const results: WebSearchResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
    // A rejected provider (e.g. rate-limited) is skipped, not fatal — the
    // other configured providers can still supply sources.
  }

  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return deduped.slice(0, maxResults);
}
