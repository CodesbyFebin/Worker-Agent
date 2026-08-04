import { complete, completeJSON } from "../_core/llm";
import type { AgentExecutionContext } from "./base";

interface ReviewResult {
  approved: boolean;
  issues: string[];
  notes: string;
}

const SYSTEM_PROMPT = `You are the reviewer agent — the last check before a safety gate.
Review the given content against the instructions/context provided. Flag
unsupported factual claims, tone problems, and anything that contradicts
the stated goal. Be specific: each issue should say what's wrong and where.`;

export async function executeReviewTask(ctx: AgentExecutionContext): Promise<ReviewResult> {
  try {
    return await completeJSON<ReviewResult>({
      system: SYSTEM_PROMPT,
      prompt: `Task: ${ctx.title}\nContent + context to review:\n"""\n${ctx.instructions}\n"""\n\nReturn JSON: {"approved":true,"issues":[],"notes":"short"}`,
      maxTokens: 600,
    });
  } catch {
    const notes = await complete({
      system: SYSTEM_PROMPT + "\n\nOutput plain text notes only. Start with APPROVE or REVISE.",
      prompt: `Task: ${ctx.title}\nContent:\n${ctx.instructions}`,
      maxTokens: 500,
    });
    const approved = /^\s*APPROVE/i.test(notes);
    return {
      approved,
      issues: approved ? [] : [notes.trim().slice(0, 500)],
      notes: notes.trim().slice(0, 800),
    };
  }
}
