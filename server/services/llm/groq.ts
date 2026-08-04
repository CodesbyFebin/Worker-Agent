import type { LlmCompleteParams, LlmCompleteResult } from "./types";

/**
 * Groq free-tier OpenAI-compatible API.
 * Docs: https://console.groq.com/docs/api-reference
 * Requires GROQ_API_KEY (free tier, rate-limited).
 */
export async function completeGroq(
  apiKey: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = params.model ?? "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    throw new Error(`Groq failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq response had no content");
  return {
    text,
    provider: "groq",
    model,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}
