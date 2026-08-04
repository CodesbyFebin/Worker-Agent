import { env } from "../../_core/env";
import { completeAnthropic } from "./anthropic";
import { completeGemini } from "./gemini";
import { completeGroq } from "./groq";
import { completeNvidia, listNvidiaModels, NVIDIA_DEFAULT_MODEL, NVIDIA_CURATED_MODELS } from "./nvidia";
import { completeOllama, probeOllama } from "./ollama";
import { completeOpenRouter, listOpenRouterFreeModels } from "./openrouter";
import { completePollinations, listPollinationsAnonymousModels } from "./pollinations";
import { getLlmPrefs } from "./runtimePrefs";
import type { LlmCompleteParams, LlmCompleteResult, LlmProviderId, LlmProviderStatus } from "./types";

const ALL_PROVIDERS: LlmProviderId[] = [
  "ollama",
  "openrouter",
  "nvidia",
  "pollinations",
  "groq",
  "gemini",
  "anthropic",
];

function effectiveProvider(): LlmProviderId | "auto" {
  return getLlmPrefs().provider ?? env.LLM_PROVIDER;
}

function effectiveModel(override?: string): string | undefined {
  if (override) return override;
  return getLlmPrefs().model ?? env.LLM_MODEL ?? undefined;
}

function providerOrder(): LlmProviderId[] {
  const active = effectiveProvider();
  if (active !== "auto") return [active];

  const preferred = env.LLM_FALLBACK.split(",")
    .map((s) => s.trim())
    .filter(Boolean) as LlmProviderId[];

  const cleaned = preferred.filter((p) => ALL_PROVIDERS.includes(p));
  return cleaned.length ? cleaned : [...ALL_PROVIDERS];
}

async function runProvider(
  id: LlmProviderId,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = effectiveModel(params.model);
  const withModel = { ...params, model };

  switch (id) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
      return completeAnthropic(env.ANTHROPIC_API_KEY, withModel);
    }
    case "ollama":
      return completeOllama(env.OLLAMA_BASE_URL, withModel);
    case "openrouter": {
      if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
      return completeOpenRouter(env.OPENROUTER_API_KEY, withModel);
    }
    case "nvidia": {
      if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
      return completeNvidia(env.NVIDIA_API_KEY, withModel);
    }
    case "groq": {
      if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
      return completeGroq(env.GROQ_API_KEY, withModel);
    }
    case "gemini": {
      if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
      return completeGemini(env.GEMINI_API_KEY, withModel);
    }
    case "pollinations":
      return completePollinations(env.POLLINATIONS_API_KEY, withModel);
    default:
      throw new Error(`Unknown LLM provider: ${id}`);
  }
}

/**
 * Routes a completion across configured providers. In `auto` mode, tries the
 * fallback chain and surfaces the first success; if all fail, throws with
 * every error (no silent fake completion).
 */
export async function routeComplete(params: LlmCompleteParams): Promise<LlmCompleteResult> {
  const order = providerOrder();
  const errors: string[] = [];

  for (const id of order) {
    try {
      if (id === "ollama" && !(await probeOllama(env.OLLAMA_BASE_URL))) {
        errors.push("ollama: not reachable at OLLAMA_BASE_URL");
        continue;
      }
      if (id === "openrouter" && !env.OPENROUTER_API_KEY) {
        errors.push("openrouter: OPENROUTER_API_KEY not set");
        continue;
      }
      if (id === "nvidia" && !env.NVIDIA_API_KEY) {
        errors.push("nvidia: NVIDIA_API_KEY not set");
        continue;
      }
      if (id === "groq" && !env.GROQ_API_KEY) {
        errors.push("groq: GROQ_API_KEY not set");
        continue;
      }
      if (id === "gemini" && !env.GEMINI_API_KEY) {
        errors.push("gemini: GEMINI_API_KEY not set");
        continue;
      }
      if (id === "anthropic" && !env.ANTHROPIC_API_KEY) {
        errors.push("anthropic: ANTHROPIC_API_KEY not set");
        continue;
      }
      return await runProvider(id, params);
    } catch (err) {
      errors.push(`${id}: ${(err as Error).message}`);
    }
  }

  throw new Error(
    `All LLM providers failed (${order.join(" → ")}).\n` + errors.map((e) => `- ${e}`).join("\n"),
  );
}

export async function listProviderStatus(): Promise<LlmProviderStatus[]> {
  const ollamaUp = await probeOllama(env.OLLAMA_BASE_URL);
  const pollModels = await listPollinationsAnonymousModels();
  const prefs = getLlmPrefs();
  const activeModel = prefs.model ?? env.LLM_MODEL ?? null;

  let openrouterFree: Array<{ id: string; name: string }> = [];
  let openrouterNote = "Get a free key at openrouter.ai/keys — use openrouter/free or any :free model";
  if (env.OPENROUTER_API_KEY) {
    try {
      const listed = await listOpenRouterFreeModels(env.OPENROUTER_API_KEY);
      openrouterFree = listed.map((m) => ({ id: m.id, name: m.name }));
      openrouterNote = `${openrouterFree.length} free models listed from OpenRouter API (live catalog)`;
    } catch (err) {
      openrouterNote = `OPENROUTER_API_KEY set but model list failed: ${(err as Error).message}`;
    }
  }

  let nvidiaModels: Array<{ id: string; name: string }> = NVIDIA_CURATED_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
  }));
  let nvidiaNote = "Get a free nvapi- key at build.nvidia.com — NIM OpenAI-compatible endpoint";
  if (env.NVIDIA_API_KEY) {
    try {
      const listed = await listNvidiaModels(env.NVIDIA_API_KEY);
      nvidiaModels = listed.map((m) => ({ id: m.id, name: m.name }));
      nvidiaNote = `${nvidiaModels.length} NIM models (curated Kimi/GLM/MiniMax/Laguna + live catalog)`;
    } catch (err) {
      nvidiaNote = `NVIDIA_API_KEY set; curated models available (${nvidiaModels.length}). Live list: ${(err as Error).message}`;
    }
  }

  return [
    {
      id: "ollama",
      label: "Ollama (local)",
      free: true,
      configured: true,
      reachable: ollamaUp,
      defaultModel: env.LLM_MODEL && env.LLM_PROVIDER === "ollama" ? env.LLM_MODEL : "first local tag / llama3.2",
      note: ollamaUp
        ? `Reachable at ${env.OLLAMA_BASE_URL}`
        : `Not running — install from ollama.com and pull a model (e.g. ollama pull llama3.2)`,
    },
    {
      id: "openrouter",
      label: "OpenRouter (free cloud models)",
      free: true,
      configured: Boolean(env.OPENROUTER_API_KEY),
      reachable: env.OPENROUTER_API_KEY ? null : false,
      defaultModel: activeModel ?? "openrouter/free",
      note: openrouterNote,
      freeModels: openrouterFree.length ? openrouterFree : undefined,
    },
    {
      id: "nvidia",
      label: "NVIDIA NIM (build.nvidia.com)",
      free: true,
      configured: Boolean(env.NVIDIA_API_KEY),
      reachable: env.NVIDIA_API_KEY ? null : false,
      defaultModel: NVIDIA_DEFAULT_MODEL,
      note: nvidiaNote,
      freeModels: nvidiaModels.length ? nvidiaModels : undefined,
    },
    {
      id: "pollinations",
      label: "Pollinations (anonymous / keyed)",
      free: true,
      configured: true,
      reachable: null,
      defaultModel: pollModels[0] ?? "openai-fast",
      note: env.POLLINATIONS_API_KEY
        ? "Using POLLINATIONS_API_KEY against gen.pollinations.ai"
        : `Anonymous GET text.pollinations.ai — free models: ${pollModels.join(", ")}. Rate limits / 402s happen; set POLLINATIONS_API_KEY if needed.`,
      freeModels: pollModels.map((id) => ({ id, name: id })),
    },
    {
      id: "groq",
      label: "Groq free tier",
      free: true,
      configured: Boolean(env.GROQ_API_KEY),
      reachable: env.GROQ_API_KEY ? null : false,
      defaultModel: "llama-3.1-8b-instant",
      note: env.GROQ_API_KEY
        ? "GROQ_API_KEY set"
        : "Get a free key at console.groq.com — not mocked when unset",
      freeModels: env.GROQ_API_KEY
        ? [
            { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
            { id: "gemma2-9b-it", name: "Gemma 2 9B" },
          ]
        : undefined,
    },
    {
      id: "gemini",
      label: "Google Gemini free tier",
      free: true,
      configured: Boolean(env.GEMINI_API_KEY),
      reachable: env.GEMINI_API_KEY ? null : false,
      defaultModel: "gemini-2.0-flash",
      note: env.GEMINI_API_KEY
        ? "GEMINI_API_KEY set"
        : "Get a free key at aistudio.google.com — not mocked when unset",
      freeModels: env.GEMINI_API_KEY
        ? [
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
            { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
          ]
        : undefined,
    },
    {
      id: "anthropic",
      label: "Anthropic Claude",
      free: false,
      configured: Boolean(env.ANTHROPIC_API_KEY),
      reachable: env.ANTHROPIC_API_KEY ? null : false,
      defaultModel: "claude-sonnet-4-6",
      note: env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY set" : "Optional if a free provider is configured",
    },
  ];
}

/** Flat catalog of free cloud models across configured providers (for IDEa Models). */
export async function listAllFreeCloudModels(): Promise<
  Array<{ provider: LlmProviderId; id: string; name: string }>
> {
  const statuses = await listProviderStatus();
  const out: Array<{ provider: LlmProviderId; id: string; name: string }> = [];
  for (const s of statuses) {
    if (!s.free || !s.configured) continue;
    for (const m of s.freeModels ?? [{ id: s.defaultModel, name: s.defaultModel }]) {
      out.push({ provider: s.id, id: m.id, name: m.name });
    }
  }
  return out;
}
