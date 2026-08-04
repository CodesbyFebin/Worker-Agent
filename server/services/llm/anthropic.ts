import type { LlmCompleteParams, LlmCompleteResult } from "./types";

const MODEL = "claude-sonnet-4-6";

export async function completeAnthropic(
  apiKey: string,
  params: LlmCompleteParams,
): Promise<LlmCompleteResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model = params.model ?? MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response contained no text content");
  }

  return {
    text: textBlock.text,
    provider: "anthropic",
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
