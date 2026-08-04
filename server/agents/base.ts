import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "../_core/db";
import { agentTasks } from "../../drizzle/schema";
import { createWorktree, removeWorktree, setWorktreeLock } from "../_core/worktree-manager";
import { publishEvent } from "../_core/events";
import { withUsageTracking } from "../_core/costTracking";
import { env } from "../_core/env";
import type { AgentRole } from "../../shared/types";

const ARTIFACTS_ROOT = process.env.GOD_MACHINE_ARTIFACTS_DIR ?? path.join(process.cwd(), ".artifacts");

export interface AgentExecutionContext {
  taskId: string;
  title: string;
  instructions: string;
  /** Absolute path of this task's isolated Git worktree checkout — removed once the task finishes. */
  worktreePath: string;
  /**
   * Persistent directory for binary outputs (video/audio/images) that must
   * survive past this task's own lifecycle so downstream pipeline stages can
   * read them. Falls back to worktreePath for non-campaign tasks that have
   * nothing to hand off (coder/researcher/writer/reviewer/qa/publisher).
   */
  artifactsDir: string;
  /** Raw payload JSON in case an agent needs more than `instructions` (e.g. coder file lists). */
  rawPayload: Record<string, unknown>;
}

export type AgentExecutor = (ctx: AgentExecutionContext) => Promise<unknown>;

/**
 * Runs a single pending task end-to-end:
 * pending -> assigned (worktree created) -> running -> completed | failed.
 * Every agent role goes through this same lifecycle so status/worktree
 * bookkeeping lives in one place instead of being duplicated per agent.
 *
 * NOTE: the worktree itself is torn down in the `finally` block below —
 * only files written to `ctx.artifactsDir` are guaranteed to still exist
 * once this function returns.
 */
export async function runAgentTask(taskId: string, executor: AgentExecutor): Promise<void> {
  const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const rawPayload = JSON.parse(task.payload) as Record<string, unknown>;
  const instructions = typeof rawPayload.instructions === "string" ? rawPayload.instructions : "";

  const worktree = await createWorktree({
    agentDepartment: task.agentRole as AgentRole,
    taskId,
  });
  await setWorktreeLock(worktree.id, true);

  const artifactsDir = task.campaignId
    ? path.join(ARTIFACTS_ROOT, task.campaignId, `day-${task.dayIndex ?? 0}`)
    : worktree.worktreePath;
  await fs.mkdir(artifactsDir, { recursive: true });

  await db
    .update(agentTasks)
    .set({ status: "running", worktreeId: worktree.id, attempts: task.attempts + 1 })
    .where(eq(agentTasks.id, taskId));
  await publishEvent({ taskId, eventType: "status_changed", message: `running (attempt ${task.attempts + 1})` });

  try {
    const { result, usage } = await withUsageTracking(() =>
      executor({
        taskId,
        title: task.title,
        instructions,
        worktreePath: worktree.worktreePath,
        artifactsDir,
        rawPayload,
      }),
    );

    const costUsd =
      (usage.inputTokens / 1_000_000) * env.PRICE_PER_MILLION_INPUT_TOKENS_USD +
      (usage.outputTokens / 1_000_000) * env.PRICE_PER_MILLION_OUTPUT_TOKENS_USD;

    await db
      .update(agentTasks)
      .set({
        status: "completed",
        result: JSON.stringify(result),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: costUsd.toFixed(6),
      })
      .where(eq(agentTasks.id, taskId));
    await publishEvent({ taskId, eventType: "status_changed", message: "completed" });

    // Content Ops: writer drafts land in Script Studio via pipeline
    if (task.agentRole === "writer" && result && typeof result === "object") {
      const draft = (result as { draft?: unknown }).draft;
      if (typeof draft === "string" && draft.trim()) {
        try {
          const { ingestWriterDraftForTask } = await import("../services/pipeline/contentOpsPipeline");
          await ingestWriterDraftForTask({
            taskId,
            scriptId: task.scriptId,
            draft,
            titleHint: task.title,
          });
        } catch (err) {
          console.warn("[pipeline] ingest writer draft failed:", (err as Error).message);
        }
      }
    }
  } catch (err) {
    await db
      .update(agentTasks)
      .set({ status: "failed", errorMessage: (err as Error).message })
      .where(eq(agentTasks.id, taskId));
    await publishEvent({ taskId, eventType: "error", message: (err as Error).message });
    throw err;
  } finally {
    await setWorktreeLock(worktree.id, false);
    await removeWorktree(worktree.id);
  }
}

