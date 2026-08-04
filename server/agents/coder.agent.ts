import { completeJSON } from "../_core/llm";
import { writeFiles, commitAll, pushBranch, openPullRequest } from "../services/vcs/github";
import { db } from "../_core/db";
import { agentWorktrees } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { AgentExecutionContext } from "./base";

interface CodeChangePlan {
  commitMessage: string;
  reasoning: string;
  files: Array<{ path: string; content: string }>;
}

const SYSTEM_PROMPT = `You are the coder agent. Given instructions describing a code
change, produce the FULL contents of every file that needs to be created or
modified — not a diff/patch, the complete file content each time, since these
will be written directly to disk. Keep the change scoped to exactly what the
instructions ask for. Do not touch files unrelated to the task. Also give a
short (1-2 sentence) reasoning note on your approach — shown to whoever
reviews the resulting PR.`;

/**
 * Either uses an explicit file list passed in the task payload
 * (`rawPayload.files`), or asks the LLM to produce one from the instructions.
 * Writes the result into the task's isolated worktree, commits, pushes, and
 * opens a PR — this hits real GitHub APIs, so GITHUB_TOKEN/GITHUB_REPO must
 * be configured.
 */
export async function executeCodeTask(ctx: AgentExecutionContext): Promise<{
  prUrl: string;
  filesChanged: string[];
  reasoning: string;
}> {
  const providedFiles = (ctx.rawPayload.files as CodeChangePlan["files"] | undefined) ?? null;

  const plan: CodeChangePlan = providedFiles
    ? { commitMessage: ctx.title, reasoning: "", files: providedFiles }
    : await completeJSON<CodeChangePlan>({
        system: SYSTEM_PROMPT,
        prompt: `Task: ${ctx.title}\nInstructions: ${ctx.instructions}\n\nReturn JSON: { "commitMessage": string, "reasoning": string, "files": [{ "path": string, "content": string }] }`,
        maxTokens: 3000,
      });

  if (!plan.files?.length) {
    throw new Error("Coder agent produced no file changes");
  }

  await writeFiles(ctx.worktreePath, plan.files);
  await commitAll(ctx.worktreePath, plan.commitMessage || ctx.title);

  const [worktree] = await db
    .select()
    .from(agentWorktrees)
    .where(eq(agentWorktrees.path, ctx.worktreePath))
    .limit(1);
  if (!worktree) throw new Error("Could not resolve worktree branch for push");

  await pushBranch(ctx.worktreePath, worktree.branchName);

  const prUrl = await openPullRequest({
    branchName: worktree.branchName,
    title: ctx.title,
    body: `Automated change from the Coder Agent.\n\n**Reasoning:** ${plan.reasoning || "(none given)"}\n\nTask: ${ctx.title}\n\nInstructions:\n${ctx.instructions}`,
  });

  return { prUrl, filesChanged: plan.files.map((f) => f.path), reasoning: plan.reasoning };
}
