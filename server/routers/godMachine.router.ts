import { and, eq, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { agentTasks, agentWorktrees } from "../../drizzle/schema";
import { orchestrateGoal } from "../_core/god-machine";
import { dispatchTask } from "../agents";
import { complete } from "../_core/llm";
import type { AgentRole } from "../../shared/types";

function toDTO(row: typeof agentTasks.$inferSelect) {
  return {
    ...row,
    payload: JSON.parse(row.payload),
    result: row.result ? JSON.parse(row.result) : null,
    costUsd: row.costUsd != null ? Number(row.costUsd) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const godMachineRouter = router({
  /**
   * ChatGPT-style Ask mode — single LLM turn, no task tree / agents.
   * Uses the real LLM router; never returns canned text.
   */
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(8000),
        /** Prior turns for short context (no persistent chat store yet). */
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(8000),
            }),
          )
          .max(20)
          .optional()
          .default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const historyBlock = (input.history ?? [])
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      const text = await complete({
        system:
          "You are God Machine Ask mode in WorkerAgent.Cloud — a concise, helpful " +
          "assistant. Prefer clear answers. If the user needs multi-agent execution " +
          "(research, write, code, publish), suggest switching to Codex agent mode.",
        prompt: historyBlock
          ? `${historyBlock}\n\nUser: ${input.message}\n\nAssistant:`
          : input.message,
        maxTokens: 2048,
      });
      return { text };
    }),

  /**
   * Planner decomposes the goal, then the orchestration engine auto-runs
   * every subtask in order (with retry/backoff) in the background. Returns
   * as soon as planning is done — poll getTaskTree for live progress.
   * Powers Codex-style agent mode in the God Machine chat UI.
   */
  dispatchGoal: protectedProcedure
    .input(z.object({ goal: z.string().min(1).max(2000), scriptId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      return orchestrateGoal({
        ...input,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      });
    }),

  /**
   * Manually (re-)runs a single subtask — used to retry a "blocked" or
   * "failed" task after a human has fixed whatever the underlying issue was
   * (e.g. added a missing API token), since the auto-chain won't retry a
   * task past its own MAX_ATTEMPTS_PER_TASK on its own.
   */
  runSubtask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(agentTasks)
        .where(and(eq(agentTasks.id, input.taskId), eq(agentTasks.organizationId, ctx.organizationId)))
        .limit(1);

      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!["pending", "blocked", "failed"].includes(task.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Task is "${task.status}" — nothing to (re-)run`,
        });
      }

      try {
        await dispatchTask(task.id, task.agentRole as AgentRole);
        return { ok: true as const };
      } catch (err) {
        // Task row already marked failed; return structured error for UI Retry
        return { ok: false as const, error: (err as Error).message };
      }
    }),

  /**
   * Run every pending/blocked/failed child under a root (Codex "run" command).
   * Sequential — preserves researcher → writer → reviewer order.
   */
  runPendingChain: protectedProcedure
    .input(z.object({ rootTaskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const children = await ctx.db
        .select()
        .from(agentTasks)
        .where(
          and(
            eq(agentTasks.parentTaskId, input.rootTaskId),
            eq(agentTasks.organizationId, ctx.organizationId),
          ),
        );

      const runnable = children
        .slice()
        .sort((a, b) => a.order - b.order)
        .filter((t) => ["pending", "blocked", "failed"].includes(t.status));

      if (!runnable.length) {
        return { ok: true as const, ran: 0, taskIds: [] as string[] };
      }

      const taskIds: string[] = [];
      for (const task of runnable) {
        // Reset blocked → pending so dispatch is allowed by lifecycle
        if (task.status === "blocked") {
          await ctx.db
            .update(agentTasks)
            .set({ status: "pending", errorMessage: null })
            .where(eq(agentTasks.id, task.id));
        }
        try {
          await dispatchTask(task.id, task.agentRole as AgentRole);
          taskIds.push(task.id);
        } catch (err) {
          // stop chain; task already marked failed inside runAgentTask
          console.error("[runPendingChain]", task.id, (err as Error).message);
          break;
        }
        const [fresh] = await ctx.db
          .select()
          .from(agentTasks)
          .where(eq(agentTasks.id, task.id))
          .limit(1);
        if (fresh && ["failed", "blocked"].includes(fresh.status)) break;
      }
      return { ok: true as const, ran: taskIds.length, taskIds };
    }),

  /** Full task tree for a root planner task — used by God Machine / Codex UI. */
  getTaskTree: protectedProcedure
    .input(z.object({ rootTaskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const root = await ctx.db
        .select()
        .from(agentTasks)
        .where(
          and(eq(agentTasks.id, input.rootTaskId), eq(agentTasks.organizationId, ctx.organizationId)),
        )
        .limit(1);

      const children = await ctx.db
        .select()
        .from(agentTasks)
        .where(
          and(
            eq(agentTasks.parentTaskId, input.rootTaskId),
            eq(agentTasks.organizationId, ctx.organizationId),
          ),
        );

      if (!root[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Root task not found" });

      const worktreeIds = [
        ...new Set(
          children.map((c) => c.worktreeId).filter((id): id is string => Boolean(id)),
        ),
      ];
      const worktreeRows =
        worktreeIds.length > 0
          ? await ctx.db.select().from(agentWorktrees).where(inArray(agentWorktrees.id, worktreeIds))
          : [];
      const worktreeById = new Map(worktreeRows.map((w) => [w.id, w]));

      return {
        root: toDTO(root[0]),
        subtasks: children
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((row) => {
            const dto = toDTO(row);
            const wt = row.worktreeId ? worktreeById.get(row.worktreeId) : undefined;
            return {
              ...dto,
              worktree: wt
                ? {
                    id: wt.id,
                    branchName: wt.branchName,
                    path: wt.path,
                    isLocked: wt.isLocked,
                  }
                : null,
            };
          }),
      };
    }),

  /** Any root (parentless) tasks — used to list active/past God Machine runs. */
  listRootTasks: protectedProcedure.query(async ({ ctx }) => {
    const roots = await ctx.db.select().from(agentTasks).where(isNull(agentTasks.parentTaskId));
    return roots.map(toDTO);
  }),

  /**
   * Every task currently "running" or "assigned" across the whole platform —
   * not scoped to one root/campaign. Powers the persistent Agent Rail so a
   * person can see what's actually alive right now from anywhere in the app.
   */
  listActive: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(agentTasks)
      .where(inArray(agentTasks.status, ["running", "assigned"]));
    return rows.map(toDTO);
  }),
});
