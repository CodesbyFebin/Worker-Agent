import { completeOpenAICompatible, listOpenAICompatibleModels, type CatalogModel } from "./openaiCompatible";
import type { LlmCompleteParams, LlmCompleteResult } from "./types";

const BASE = "https://openrouter.ai/api/v1";

/**
 * OpenRouter — API key required. Prefer free models via `openrouter/free`
 * router or any id ending in `:free`.
 * Docs: https://openrouter.ai/docs
 */
export async function completeOpenRouter(
  apiKey: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = params.model ?? "openrouter/free";
  return completeOpenAICompatible({
    provider: "openrouter",
    baseUrl: BASE,
    apiKey,
    model,
    params,
    extraHeaders: {
      "HTTP-Referer": "https://worker-agent.cloud",
      "X-Title": "WorkerAgent.Cloud",
    },
  });
}

export async function listOpenRouterFreeModels(apiKey: string): Promise<CatalogModel[]> {
  const all = await listOpenAICompatibleModels({
    baseUrl: BASE,
    apiKey,
    extraHeaders: {
      "HTTP-Referer": "https://worker-agent.cloud",
      "X-Title": "WorkerAgent.Cloud",
    },
  });
  const free = all.filter((m) => m.free || m.id.endsWith(":free") || m.id === "openrouter/free");
  // Always surface the free router first when key works
  if (!free.some((m) => m.id === "openrouter/free")) {
    free.unshift({
      id: "openrouter/free",
      name: "OpenRouter Free Models Router",
      free: true,
      contextLength: null,
    });
  }
  return free.sort((a, b) => a.id.localeCompare(b.id));
}
