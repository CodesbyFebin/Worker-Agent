import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { env } from "../_core/env";
import { getLlmPrefs, setLlmPrefs } from "../services/llm/runtimePrefs";
import { listAllFreeCloudModels, listProviderStatus } from "../services/llm/router";
import { listOpenRouterFreeModels } from "../services/llm/openrouter";
import { listNvidiaModels, listNvidiaCuratedModels } from "../services/llm/nvidia";

const providerEnum = z.enum([
  "auto",
  "openrouter",
  "ollama",
  "nvidia",
  "pollinations",
  "groq",
  "gemini",
  "anthropic",
]);

/**
 * Runtime LLM + connector preferences used by every page that calls complete().
 */
export const settingsRouter = router({
  getLlm: protectedProcedure.query(async () => {
    const prefs = getLlmPrefs();
    const providers = await listProviderStatus();
    const freeCloudModels = await listAllFreeCloudModels();
    return {
      envProvider: env.LLM_PROVIDER,
      envModel: env.LLM_MODEL ?? null,
      prefs,
      activeProvider: prefs.provider ?? env.LLM_PROVIDER,
      activeModel: prefs.model ?? env.LLM_MODEL ?? "openrouter/free",
      providers,
      freeCloudModels,
    };
  }),

  setLlm: protectedProcedure
    .input(
      z.object({
        provider: providerEnum.nullable().optional(),
        model: z.string().min(1).max(200).nullable().optional(),
      }),
    )
    .mutation(({ input }) => {
      return setLlmPrefs({
        provider: input.provider === undefined ? undefined : input.provider,
        model: input.model === undefined ? undefined : input.model,
      });
    }),

  /** Live OpenRouter :free catalog only — empty if key missing. */
  listOpenRouterFree: protectedProcedure.query(async () => {
    if (!env.OPENROUTER_API_KEY) {
      return { configured: false as const, models: [] as Array<{ id: string; name: string }> };
    }
    const models = await listOpenRouterFreeModels(env.OPENROUTER_API_KEY);
    return {
      configured: true as const,
      models: models.map((m) => ({ id: m.id, name: m.name })),
    };
  }),

  /** NVIDIA NIM curated (Kimi / GLM / MiniMax / Laguna) + live catalog. */
  listNvidiaModels: protectedProcedure.query(async () => {
    if (!env.NVIDIA_API_KEY) {
      return {
        configured: false as const,
        models: listNvidiaCuratedModels().map((m) => ({ id: m.id, name: m.name })),
      };
    }
    const models = await listNvidiaModels(env.NVIDIA_API_KEY);
    return {
      configured: true as const,
      models: models.map((m) => ({ id: m.id, name: m.name })),
    };
  }),
});
