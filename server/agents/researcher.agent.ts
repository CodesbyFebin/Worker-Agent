import { complete } from "../_core/llm";
import { env } from "../_core/env";
import type { AgentExecutionContext } from "./base";

const SYSTEM_PROMPT = `You are the researcher agent. Summarize findings and list
specific claims that need source verification before publish. Be concise.`;

export async function executeResearchTask(ctx: AgentExecutionContext): Promise<{
  summary: string;
  claimsNeedingVerification: string[];
  sources?: Array<{ title: string; url: string }>;
}> {
  let searchBlock = "";
  let sources: Array<{ title: string; url: string }> = [];
  const hasSearch = Boolean(env.TAVILY_API_KEY || env.BRAVE_SEARCH_API_KEY || env.SERPER_API_KEY);

  if (hasSearch) {
    try {
      const { webSearch } = await import("../services/search");
      const hits = await webSearch(`${ctx.title} ${ctx.instructions}`.slice(0, 200), 5);
      sources = hits.map((h) => ({ title: h.title, url: h.url }));
      searchBlock =
        "\n\nWeb search results (real):\n" +
        hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}\n${h.snippet ?? ""}`).join("\n\n");
    } catch (err) {
      searchBlock = `\n\n(Web search failed: ${(err as Error).message})`;
    }
  } else {
    searchBlock =
      "\n\n(No search API keys — summarizing from instructions only. Set TAVILY/BRAVE/SERPER for live sources.)";
  }

  const raw = await complete({
    system: SYSTEM_PROMPT,
    prompt: `Task: ${ctx.title}\nInstructions: ${ctx.instructions}${searchBlock}\n\nProvide a short summary, then on a new line "CLAIMS TO VERIFY:" followed by a bullet list.`,
    maxTokens: 800,
  });

  const [summaryPart, claimsPart] = raw.split(/CLAIMS TO VERIFY:/i);
  const claimsNeedingVerification = (claimsPart ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return {
    summary: (summaryPart ?? raw).trim(),
    claimsNeedingVerification,
    sources: sources.length ? sources : undefined,
  };
}
