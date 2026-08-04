export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

export type SearchProvider = (query: string, maxResults: number) => Promise<WebSearchResult[]>;
