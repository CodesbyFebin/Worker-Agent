import { completeOpenAICompatible, listOpenAICompatibleModels, type CatalogModel } from "./openaiCompatible";
import type { LlmCompleteParams, LlmCompleteResult } from "./types";

const BASE = "https://integrate.api.nvidia.com/v1";

/**
 * Curated NIM models pinned in God Machine / ModelChooser.
 * From build.nvidia.com — OpenAI-compatible at integrate.api.nvidia.com.
 *
 * Note: availability depends on the NGC account enabling each model.
 * MiniMax M3 + Laguna XS are known-good on typical free NIM keys;
 * Kimi / GLM may 404 until enabled on the account.
 */
export const NVIDIA_CURATED_MODELS: CatalogModel[] = [
  {
    id: "minimaxai/minimax-m3",
    name: "MiniMax M3",
    free: true,
    contextLength: null,
  },
  {
    id: "poolside/laguna-xs-2.1",
    name: "Poolside Laguna XS 2.1",
    free: true,
    contextLength: null,
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Moonshot Kimi K2.6",
    free: true,
    contextLength: null,
  },
  {
    id: "z-ai/glm-5.2",
    name: "Z.AI GLM 5.2",
    free: true,
    contextLength: null,
  },
];

export const NVIDIA_DEFAULT_MODEL = "minimaxai/minimax-m3";

/**
 * Resolve API key for a model. Optional NVIDIA_MODEL_KEYS JSON map:
 * {"minimaxai/minimax-m3":"nvapi-…","poolside/laguna-xs-2.1":"nvapi-…"}
 * falls back to NVIDIA_API_KEY.
 */
export function resolveNvidiaApiKey(primaryKey: string, model: string): string {
  const raw = process.env.NVIDIA_MODEL_KEYS;
  if (!raw?.trim()) return primaryKey;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const exact = map[model];
    if (exact?.startsWith("nvapi-")) return exact;
    const prefix = Object.entries(map).find(([k]) => model.startsWith(k));
    if (prefix?.[1]?.startsWith("nvapi-")) return prefix[1];
  } catch {
    /* ignore bad JSON */
  }
  return primaryKey;
}

/**
 * NVIDIA NIM hosted inference (build.nvidia.com) — OpenAI-compatible.
 */
export async function completeNvidia(
  apiKey: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = params.model ?? NVIDIA_DEFAULT_MODEL;
  const key = resolveNvidiaApiKey(apiKey, model);
  return completeOpenAICompatible({
    provider: "nvidia",
    baseUrl: BASE,
    apiKey: key,
    model,
    params,
  });
}

/** Curated list always available when key is set (even if /models is empty or fails). */
export function listNvidiaCuratedModels(): CatalogModel[] {
  return [...NVIDIA_CURATED_MODELS];
}

export async function listNvidiaModels(apiKey: string): Promise<CatalogModel[]> {
  const curated = listNvidiaCuratedModels();
  const byId = new Map(curated.map((m) => [m.id, m]));

  try {
    const all = await listOpenAICompatibleModels({ baseUrl: BASE, apiKey });
    for (const m of all) {
      if (!byId.has(m.id)) {
        byId.set(m.id, { ...m, free: true });
      }
    }
  } catch {
    // Keep curated — do not invent beyond pinned + live catalog
  }

  const rest = [...byId.values()]
    .filter((m) => !NVIDIA_CURATED_MODELS.some((c) => c.id === m.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return [...curated, ...rest];
}
