import { recordUsage } from "./costTracking";
import { routeComplete } from "../services/llm/router";

export type { LlmProviderId, LlmProviderStatus } from "../services/llm/types";
export { listProviderStatus } from "../services/llm/router";

/**
 * Thin completion facade — routes to Anthropic / Ollama / OpenRouter / NVIDIA
 * NIM / Groq / Gemini / Pollinations per LLM_PROVIDER (+ auto fallback).
 * Throws on total failure; never returns canned text.
 */
export async function complete(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const result = await routeComplete(params);
  if (result.inputTokens != null || result.outputTokens != null) {
    recordUsage(result.inputTokens ?? 0, result.outputTokens ?? 0);
  }
  return result.text;
}

/** Pull the first balanced `{ ... }` JSON object from a model reply. */
function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Best-effort close of truncated JSON (unterminated string / missing braces/brackets).
 */
function repairTruncatedJson(raw: string): string | null {
  let s = raw.replace(/```json|```/g, "").trim();
  const start = s.indexOf("{");
  if (start < 0) return null;
  s = s.slice(start);

  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
  }
  if (inString) s += '"';

  // Drop a trailing incomplete key/value fragment after last complete value
  s = s.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, "");
  s = s.replace(/,\s*$/, "");

  let brace = 0;
  let bracket = 0;
  inString = false;
  escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") brace++;
    else if (ch === "}") brace--;
    else if (ch === "[") bracket++;
    else if (ch === "]") bracket--;
  }
  while (bracket > 0) {
    s += "]";
    bracket--;
  }
  while (brace > 0) {
    s += "}";
    brace--;
  }

  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}

function tryParseJson<T>(raw: string): T | null {
  const extracted = extractJsonObject(raw) ?? raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(extracted) as T;
  } catch {
    const repaired = repairTruncatedJson(raw);
    if (!repaired) return null;
    try {
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Same as `complete`, but instructs the model to return only JSON and
 * parses it. Retries once on truncation/parse failure (common with free models).
 */
export async function completeJSON<T>(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const maxTokens = params.maxTokens ?? 1200;
  const system = `${params.system}\n\nRespond with ONLY valid JSON. No markdown, no preamble, no code fences. Keep string values concise so the JSON fits.`;

  let raw = await complete({ ...params, system, maxTokens });
  let parsed = tryParseJson<T>(raw);
  if (parsed) return parsed;

  // Retry: ask model to finish / shrink the JSON
  raw = await complete({
    ...params,
    system:
      "You repair incomplete JSON. Output ONLY a complete valid JSON object. " +
      "Shorten long string fields if needed. No markdown.",
    prompt:
      `The previous JSON was truncated or invalid. Return a complete fixed version.\n\nBroken output:\n${raw.slice(0, 3500)}`,
    maxTokens: Math.max(maxTokens, 1400),
  });
  parsed = tryParseJson<T>(raw);
  if (parsed) return parsed;

  throw new Error(`Failed to parse LLM JSON output after retry\nRaw: ${raw.slice(0, 2000)}`);
}
