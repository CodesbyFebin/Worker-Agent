import { env } from "../../_core/env";
import type { SearchProvider } from "./types";

export const serperSearch: SearchProvider = async (query, maxResults) => {
  if (!env.SERPER_API_KEY) return [];

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    organic?: Array<{ title: string; link: string; snippet: string }>;
  };
  return (data.organic ?? []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    provider: "serper",
  }));
};
