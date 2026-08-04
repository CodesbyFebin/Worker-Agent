import { desc, eq, inArray, sql, and } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, permissionProcedure, router } from "../_core/trpc";
import { agentEvents, agentTasks, agentWorktrees, agentRoleEnum } from "../../drizzle/schema";
import { writeAuditLog } from "../_core/auth/audit";

function taskToDTO(row: typeof agentTasks.$inferSelect) {
  return {
    ...row,
    payload: JSON.parse(row.payload),
    result: row.result ? JSON.parse(row.result) : null,
    costUsd: row.costUsd != null ? Number(row.costUsd) : null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * IDEa — Agentic IDE surface backed by real `agent_tasks` / `agent_events` /
 * `agent_worktrees` rows. No invented confidence percentages: when a task
 * result has no reasoning/approval field, the UI shows that absence.
 */
export const ideRouter = router({
  /** One card per agent role with the newest task in that role (if any). */
  roster: protectedProcedure.query(async ({ ctx }) => {
    const recent = await ctx.db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.organizationId, ctx.organizationId))
      .orderBy(desc(agentTasks.updatedAt))
      .limit(500);

    return agentRoleEnum.map((role) => {
      const forRole = recent.filter((t) => t.agentRole === role);
      const active = forRole.find((t) => t.status === "running" || t.status === "assigned");
      const latest = forRole[0] ?? null;
      const pick = active ?? latest;
      let reasoning: string | null = null;
      if (pick?.result) {
        try {
          const parsed = JSON.parse(pick.result) as { reasoning?: unknown };
          if (typeof parsed.reasoning === "string") reasoning = parsed.reasoning;
        } catch {
          reasoning = null;
        }
      }
      return {
        role,
        status: pick?.status ?? "idle",
        latestTask: pick
          ? {
              id: pick.id,
              title: pick.title,
              status: pick.status,
              campaignId: pick.campaignId,
              inputTokens: pick.inputTokens,
              outputTokens: pick.outputTokens,
              costUsd: pick.costUsd != null ? Number(pick.costUsd) : null,
              updatedAt: pick.updatedAt.toISOString(),
              reasoning,
            }
          : null,
      };
    });
  }),

  listRecent: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(40),
          statuses: z
            .array(
              z.enum([
                "pending",
                "assigned",
                "running",
                "awaiting_approval",
                "blocked",
                "completed",
                "failed",
              ]),
            )
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 40;
      const rows = input?.statuses?.length
        ? await ctx.db
            .select()
            .from(agentTasks)
            .where(
              and(
                eq(agentTasks.organizationId, ctx.organizationId),
                inArray(agentTasks.status, input.statuses),
              ),
            )
            .orderBy(desc(agentTasks.updatedAt))
            .limit(limit)
        : await ctx.db
            .select()
            .from(agentTasks)
            .where(eq(agentTasks.organizationId, ctx.organizationId))
            .orderBy(desc(agentTasks.updatedAt))
            .limit(limit);
      return rows.map(taskToDTO);
    }),

  getTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(agentTasks)
        .where(and(eq(agentTasks.id, input.taskId), eq(agentTasks.organizationId, ctx.organizationId)))
        .limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      const events = await ctx.db
        .select()
        .from(agentEvents)
        .where(
          and(eq(agentEvents.taskId, input.taskId), eq(agentEvents.organizationId, ctx.organizationId)),
        )
        .orderBy(desc(agentEvents.createdAt))
        .limit(100);

      let worktree = null;
      if (task.worktreeId) {
        const [wt] = await ctx.db
          .select()
          .from(agentWorktrees)
          .where(eq(agentWorktrees.id, task.worktreeId))
          .limit(1);
        if (wt) {
          worktree = {
            ...wt,
            createdAt: wt.createdAt.toISOString(),
            removedAt: wt.removedAt?.toISOString() ?? null,
          };
        }
      }

      const result = task.result ? JSON.parse(task.result) : null;

      return {
        task: taskToDTO(task),
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
        worktree,
        /** Only surfaces fields that actually exist on the agent result — no synthetic scores. */
        inspection: {
          reasoning: typeof result?.reasoning === "string" ? result.reasoning : null,
          approved: typeof result?.approved === "boolean" ? result.approved : null,
          issues: Array.isArray(result?.issues) ? (result.issues as string[]) : null,
          prUrl: typeof result?.prUrl === "string" ? result.prUrl : null,
          draftPreview:
            typeof result?.draft === "string"
              ? result.draft.slice(0, 500)
              : typeof result?.summary === "string"
                ? result.summary.slice(0, 500)
                : null,
        },
      };
    }),

  /** Platform-wide rollup from real token/cost columns — zeros if pricing env vars unset. */
  costSummary: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        inputTokens: sql<number>`coalesce(sum(${agentTasks.inputTokens}), 0)`,
        outputTokens: sql<number>`coalesce(sum(${agentTasks.outputTokens}), 0)`,
        costUsd: sql<string>`coalesce(sum(${agentTasks.costUsd}), 0)`,
        completed: sql<number>`sum(case when ${agentTasks.status} = 'completed' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${agentTasks.status} = 'failed' then 1 else 0 end)`,
        awaiting: sql<number>`sum(case when ${agentTasks.status} = 'awaiting_approval' then 1 else 0 end)`,
        running: sql<number>`sum(case when ${agentTasks.status} in ('running','assigned') then 1 else 0 end)`,
      })
      .from(agentTasks)
      .where(eq(agentTasks.organizationId, ctx.organizationId));

    const row = rows[0];
    return {
      inputTokens: Number(row?.inputTokens ?? 0),
      outputTokens: Number(row?.outputTokens ?? 0),
      costUsd: Number(row?.costUsd ?? 0),
      completed: Number(row?.completed ?? 0),
      failed: Number(row?.failed ?? 0),
      awaitingApproval: Number(row?.awaiting ?? 0),
      running: Number(row?.running ?? 0),
    };
  }),

  listAwaitingApproval: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(agentTasks)
      .where(
        and(eq(agentTasks.status, "awaiting_approval"), eq(agentTasks.organizationId, ctx.organizationId)),
      )
      .orderBy(desc(agentTasks.updatedAt))
      .limit(50);
    return rows.map(taskToDTO);
  }),

  /** Org-scoped activity feed from agent_events. */
  listRecentEvents: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 40;
      const rows = await ctx.db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.organizationId, ctx.organizationId))
        .orderBy(desc(agentEvents.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        taskId: r.taskId,
        eventType: r.eventType,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  /**
   * Live LLM routing status — which free/paid providers are configured and
   * (for Ollama) reachable. Free cloud catalogs come from provider APIs
   * (OpenRouter / NIM / etc.) — never invented.
   */
  listLlmProviders: protectedProcedure.query(async () => {
    const { listProviderStatus, listAllFreeCloudModels } = await import("../services/llm/router");
    const { env } = await import("../_core/env");
    const providers = await listProviderStatus();
    const freeCloudModels = await listAllFreeCloudModels();
    return {
      activeProvider: env.LLM_PROVIDER,
      fallback: env.LLM_FALLBACK,
      modelOverride: env.LLM_MODEL ?? null,
      providers,
      freeCloudModels,
    };
  }),

  /**
   * Lists the real repo tree under GOD_MACHINE_REPO_ROOT (or server cwd).
   * Skips node_modules / .git / heavy dirs. Not a fake explorer — paths are
   * from the filesystem the agents also work against.
   */
  listTree: protectedProcedure
    .input(z.object({ path: z.string().optional().default("") }))
    .query(async ({ input }) => {
      const { listRepoDir } = await import("../services/ide/repoFs");
      return listRepoDir(input.path ?? "");
    }),

  readFile: protectedProcedure
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ input }) => {
      const { readRepoFile } = await import("../services/ide/repoFs");
      return readRepoFile(input.path);
    }),

  writeFile: permissionProcedure("script:write")
    .input(z.object({ path: z.string().min(1).max(512), content: z.string().max(400_000) }))
    .mutation(async ({ ctx, input }) => {
      const { writeRepoFile } = await import("../services/ide/repoFs");
      const result = await writeRepoFile(input.path, input.content);
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ide.write_file",
        resourceType: "file",
        resourceId: input.path.slice(0, 64),
        payload: { path: input.path, size: result.size },
      });
      return result;
    }),

  repoStatus: protectedProcedure.query(async () => {
    const { getRepoStatus } = await import("../services/ide/gitOps");
    return getRepoStatus();
  }),

  getDiff: protectedProcedure
    .input(
      z
        .object({
          staged: z.boolean().optional(),
          path: z.string().max(512).optional(),
          worktreeId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const { getRepoDiff } = await import("../services/ide/gitOps");
      return getRepoDiff(input ?? {});
    }),

  listWorktrees: protectedProcedure.query(async ({ ctx }) => {
    const { listActiveWorktrees } = await import("../services/ide/gitOps");
    return listActiveWorktrees(ctx.organizationId);
  }),

  removeWorktree: permissionProcedure("script:write")
    .input(z.object({ worktreeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { removeWorktree } = await import("../_core/worktree-manager");
      await removeWorktree(input.worktreeId);
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ide.remove_worktree",
        resourceType: "worktree",
        resourceId: input.worktreeId,
      });
      return { ok: true as const };
    }),

  listCommands: protectedProcedure.query(async () => {
    const { listAllowedCommands } = await import("../services/ide/gitOps");
    return listAllowedCommands();
  }),

  runCommand: permissionProcedure("script:write")
    .input(
      z.object({
        commandId: z.string().min(1).max(64),
        worktreeId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { runAllowedCommand } = await import("../services/ide/gitOps");
      const result = await runAllowedCommand(input);
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ide.run_command",
        resourceType: "command",
        resourceId: input.commandId,
        payload: { exitCode: result.exitCode, durationMs: result.durationMs, cwd: result.cwd },
      });
      return result;
    }),

  preparePr: permissionProcedure("agent:dispatch")
    .input(
      z.object({
        title: z.string().min(1).max(256),
        body: z.string().max(20_000).optional(),
        worktreeId: z.string().uuid().optional(),
        open: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { preparePullRequest } = await import("../services/ide/gitOps");
      const result = await preparePullRequest(input);
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ide.prepare_pr",
        resourceType: "pull_request",
        resourceId: result.branch ?? "unknown",
        payload: { opened: result.opened, prUrl: result.prUrl, reason: result.reason },
      });
      return result;
    }),
});
