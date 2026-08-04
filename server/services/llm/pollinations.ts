import type { LlmCompleteParams, LlmCompleteResult } from "./types";

/**
 * Pollinations text — free anonymous GET (no key) when available.
 * Verified model list: GET https://text.pollinations.ai/models
 * Known limit: anonymous access is rate-limited / intermittently returns 402
 * as their legacy API migrates; optional POLLINATIONS_API_KEY uses
 * gen.pollinations.ai OpenAI-compatible chat when set.
 */
export async function completePollinations(
  apiKey: string | undefined,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = params.model ?? "openai-fast";

  if (apiKey) {
    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.prompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pollinations (keyed) failed (${res.status}): ${body.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Pollinations keyed response had no content");
    return {
      text,
      provider: "pollinations",
      model,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  }

  // Anonymous GET — fold system into the prompt (query system= is unreliable).
  const combined = `${params.system}\n\n---\n\n${params.prompt}`;
  const url =
    `https://text.pollinations.ai/${encodeURIComponent(combined)}` +
    `?model=${encodeURIComponent(model)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Pollinations anonymous failed (${res.status}): ${body.slice(0, 300)}. ` +
        `Set POLLINATIONS_API_KEY or use ollama/groq/gemini.`,
    );
  }
  const text = await res.text();
  if (!text.trim()) throw new Error("Pollinations anonymous response was empty");
  return { text, provider: "pollinations", model, inputTokens: null, outputTokens: null };
}

export async function listPollinationsAnonymousModels(): Promise<string[]> {
  try {
    const res = await fetch("https://text.pollinations.ai/models", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return ["openai-fast"];
    const data = (await res.json()) as Array<{ name?: string; tier?: string }>;
    const names = data.filter((m) => m.tier === "anonymous" && m.name).map((m) => m.name!) ;
    return names.length ? names : ["openai-fast"];
  } catch {
    return ["openai-fast"];
  }
}
