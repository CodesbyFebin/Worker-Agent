import { complete } from "../../_core/llm";

const SYSTEM_PROMPT = `You write concise, concrete image-generation prompts (for Midjourney/
DALL-E style tools) for YouTube thumbnails. Describe composition, subject,
expression, color, and text overlay. One prompt, no preamble, under 80 words.`;

export async function generateThumbnailPrompt(scriptText: string): Promise<string> {
  const prompt = await complete({
    system: SYSTEM_PROMPT,
    prompt: `Script:\n"""\n${scriptText}\n"""\n\nWrite one thumbnail image prompt.`,
    maxTokens: 300,
  });
  return prompt.trim();
}
