import type { LlmCompleteParams, LlmCompleteResult } from "./types";

/**
 * Ollama — local, no API key. OpenAI-compatible `/v1/chat/completions`
 * (Ollama ≥0.1.26) with fallback to native `/api/chat`.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export async function completeOllama(
  baseUrl: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const root = baseUrl.replace(/\/$/, "");
  const model = params.model ?? (await defaultOllamaModel(root));

  const openaiUrl = `${root}/v1/chat/completions`;
  const openaiRes = await fetch(openaiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 1024,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.prompt },
      ],
    }),
  });

  if (openaiRes.ok) {
    const data = (await openaiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Ollama OpenAI-compat response had no content");
    return {
      text,
      provider: "ollama",
      model,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  }

  // Native chat API fallback
  const nativeRes = await fetch(`${root}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.prompt },
      ],
      options: { num_predict: params.maxTokens ?? 1024 },
    }),
  });
  if (!nativeRes.ok) {
    const body = await nativeRes.text();
    throw new Error(`Ollama failed (${openaiRes.status}/${nativeRes.status}): ${body.slice(0, 300)}`);
  }
  const native = (await nativeRes.json()) as { message?: { content?: string } };
  const text = native.message?.content;
  if (!text) throw new Error("Ollama native response had no content");
  return { text, provider: "ollama", model, inputTokens: null, outputTokens: null };
}

export async function probeOllama(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function defaultOllamaModel(root: string): Promise<string> {
  try {
    const res = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return "llama3.2";
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const name = data.models?.[0]?.name;
    return name ?? "llama3.2";
  } catch {
    return "llama3.2";
  }
}
