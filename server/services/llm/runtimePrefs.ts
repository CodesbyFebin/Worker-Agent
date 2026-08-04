import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { LlmProviderId } from "./types";

export interface LlmRuntimePrefs {
  /** Override env LLM_PROVIDER when set (null = use env). */
  provider: LlmProviderId | "auto" | null;
  /** Override env LLM_MODEL when set. */
  model: string | null;
  updatedAt: string | null;
}

const PREFS_PATH = join(process.cwd(), ".llm-prefs.json");

let cache: LlmRuntimePrefs = {
  provider: null,
  model: null,
  updatedAt: null,
};

function load(): void {
  try {
    if (!existsSync(PREFS_PATH)) return;
    const raw = JSON.parse(readFileSync(PREFS_PATH, "utf8")) as Partial<LlmRuntimePrefs>;
    cache = {
      provider: (raw.provider as LlmRuntimePrefs["provider"]) ?? null,
      model: typeof raw.model === "string" ? raw.model : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    };
  } catch {
    // keep defaults — never invent prefs
  }
}

load();

export function getLlmPrefs(): LlmRuntimePrefs {
  return { ...cache };
}

export function setLlmPrefs(next: {
  provider?: LlmProviderId | "auto" | null;
  model?: string | null;
}): LlmRuntimePrefs {
  if (next.provider !== undefined) cache.provider = next.provider;
  if (next.model !== undefined) cache.model = next.model;
  cache.updatedAt = new Date().toISOString();
  writeFileSync(PREFS_PATH, JSON.stringify(cache, null, 2), "utf8");
  return getLlmPrefs();
}
