import { env } from "../../_core/env";
import type { SearchProvider } from "./types";

export const braveSearch: SearchProvider = async (query, maxResults) => {
  if (!env.BRAVE_SEARCH_API_KEY) return [];

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    web?: { results: Array<{ title: string; url: string; description: string }> };
  };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    provider: "brave",
  }));
};
