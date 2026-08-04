import { env } from "../../_core/env";
import type { SearchProvider } from "./types";

export const tavilySearch: SearchProvider = async (query, maxResults) => {
  if (!env.TAVILY_API_KEY) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { results: Array<{ title: string; url: string; content: string }> };
  return data.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content, provider: "tavily" }));
};
