import type { LlmCompleteParams, LlmCompleteResult } from "./types";

/**
 * Google Gemini free-tier generateContent API (no extra npm dep).
 * Docs: https://ai.google.dev/api/generate-content
 * Requires GEMINI_API_KEY from Google AI Studio (free quota).
 */
export async function completeGemini(
  apiKey: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const model = params.model ?? "gemini-2.0-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: { maxOutputTokens: params.maxTokens ?? 1024 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini response had no text");
  return {
    text,
    provider: "gemini",
    model,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}
