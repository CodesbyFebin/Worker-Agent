import { complete, completeJSON } from "../_core/llm";
import type { AgentExecutionContext } from "./base";

const SYSTEM_PROMPT = `You are the writer agent. Draft the requested content from the
instructions. If research is included, only assert facts it supported.
Return concise copy suitable for the format (e.g. YouTube Short ~80-120 words).`;

export async function executeWriteTask(ctx: AgentExecutionContext): Promise<{
  draft: string;
  reasoning: string;
}> {
  // Prefer structured JSON; fall back to plain text if free models truncate JSON.
  try {
    const result = await completeJSON<{ draft: string; reasoning?: string }>({
      system: SYSTEM_PROMPT,
      prompt: `Task: ${ctx.title}\nInstructions: ${ctx.instructions}\n\nReturn JSON: {"draft":"...","reasoning":"one short sentence"}`,
      maxTokens: 1400,
    });
    return {
      draft: (result.draft ?? "").trim(),
      reasoning: (result.reasoning ?? "Drafted from instructions.").trim(),
    };
  } catch {
    const draft = await complete({
      system: SYSTEM_PROMPT + "\n\nOutput ONLY the draft text. No JSON, no preamble.",
      prompt: `Task: ${ctx.title}\nInstructions: ${ctx.instructions}`,
      maxTokens: 1200,
    });
    return {
      draft: draft.trim(),
      reasoning: "Draft returned as plain text after JSON parse fallback.",
    };
  }
}
