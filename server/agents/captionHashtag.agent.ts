import { completeJSON } from "../_core/llm";
import type { AgentExecutionContext } from "./base";

interface CaptionHashtagResult {
  caption: string;
  hashtags: string[];
}

const SYSTEM_PROMPT = `You write short-form video captions and hashtag sets. The
caption should be 1-3 sentences, hook-forward, no invented claims beyond what
the script actually says. Hashtags should mix broad-reach and niche-specific
tags — 8-15 total, no spaces, no repeated words.`;

export async function executeCaptionHashtagTask(ctx: AgentExecutionContext): Promise<CaptionHashtagResult> {
  return completeJSON<CaptionHashtagResult>({
    system: SYSTEM_PROMPT,
    prompt: `Script:\n"""\n${ctx.instructions}\n"""\n\nReturn JSON: { "caption": string, "hashtags": string[] }`,
    maxTokens: 500,
  });
}
