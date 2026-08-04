import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { agentTasks, contentCampaigns } from "../../drizzle/schema";
import { startCampaign, schedulePublish } from "../_core/youtube-automode";
import { dispatchTask } from "../agents";
import type { AgentRole } from "../../shared/types";

function toDTO(row: typeof agentTasks.$inferSelect) {
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

export const campaignRouter = router({
  /** Kicks off "YouTube AutoMode": plans N daily subtopics then runs each day's pipeline. */
  start: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1).max(500),
        totalDays: z.number().int().min(1).max(90).default(7),
        startDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return startCampaign({
        userId: ctx.userId!,
        topic: input.topic,
        totalDays: input.totalDays,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db
      .select()
      .from(contentCampaigns)
      .where(eq(contentCampaigns.userId, ctx.userId!))
      .orderBy(desc(contentCampaigns.createdAt));
    return campaigns.map((c) => ({
      ...c,
      startDate: c.startDate.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(contentCampaigns)
        .where(and(eq(contentCampaigns.id, input.campaignId), eq(contentCampaigns.userId, ctx.userId!)))
        .limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      return {
        ...campaign,
        startDate: campaign.startDate.toISOString(),
        createdAt: campaign.createdAt.toISOString(),
      };
    }),

  /**
   * Pause stops *new* stage jobs from advancing: the campaign-day worker
   * re-queues the current stage with delay while status is `paused`.
   * Jobs already mid-dispatchTask still finish — known limit until workers
   * are split and cancellation is added (see README).
   */
  setStatus: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid(), status: z.enum(["active", "paused"]) }))
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(contentCampaigns)
        .where(and(eq(contentCampaigns.id, input.campaignId), eq(contentCampaigns.userId, ctx.userId!)))
        .limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (campaign.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Completed campaigns cannot be resumed/paused" });
      }
      await ctx.db
        .update(contentCampaigns)
        .set({ status: input.status })
        .where(eq(contentCampaigns.id, input.campaignId));
      return { ok: true };
    }),

  /** Every day's root task (+ its pipeline stage children) for one campaign, in day order. */
  getDays: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const dayRoots = await ctx.db
        .select()
        .from(agentTasks)
        .where(and(eq(agentTasks.campaignId, input.campaignId), isNull(agentTasks.parentTaskId)))
        .orderBy(asc(agentTasks.dayIndex));

      const allChildren = await ctx.db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.campaignId, input.campaignId));

      return dayRoots.map((root) => ({
        day: toDTO(root),
        stages: allChildren
          .filter((c) => c.parentTaskId === root.id)
          .sort((a, b) => a.order - b.order)
          .map(toDTO),
      }));
    }),

  /**
   * Flips a day's publisher stage from "awaiting_approval" to "pending" and
   * enqueues a durable, real-delay BullMQ job for the actual scheduled
   * publish time — this is the human approval gate.
   */
  approveDay: protectedProcedure
    .input(z.object({ dayRootTaskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [publisherTask] = await ctx.db
        .select()
        .from(agentTasks)
        .where(
          and(eq(agentTasks.parentTaskId, input.dayRootTaskId), eq(agentTasks.agentRole, "publisher")),
        );

      if (!publisherTask) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No publisher stage found for this day" });
      }
      if (publisherTask.status !== "awaiting_approval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Publisher stage is "${publisherTask.status}", not awaiting approval`,
        });
      }

      await ctx.db.update(agentTasks).set({ status: "pending" }).where(eq(agentTasks.id, publisherTask.id));
      await schedulePublish(publisherTask.id, publisherTask.scheduledAt ?? new Date());

      return { ok: true, publisherTaskId: publisherTask.id, scheduledAt: publisherTask.scheduledAt?.toISOString() ?? null };
    }),

  /** Reject publish for a day — marks publisher + day root blocked with a human reason. */
  rejectDay: protectedProcedure
    .input(z.object({ dayRootTaskId: z.string().uuid(), reason: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const [publisherTask] = await ctx.db
        .select()
        .from(agentTasks)
        .where(
          and(eq(agentTasks.parentTaskId, input.dayRootTaskId), eq(agentTasks.agentRole, "publisher")),
        );
      if (!publisherTask) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No publisher stage found for this day" });
      }
      if (publisherTask.status !== "awaiting_approval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Publisher stage is "${publisherTask.status}", not awaiting approval`,
        });
      }

      const msg = `Rejected by human: ${input.reason}`;
      await ctx.db
        .update(agentTasks)
        .set({ status: "blocked", errorMessage: msg })
        .where(eq(agentTasks.id, publisherTask.id));
      await ctx.db
        .update(agentTasks)
        .set({ status: "blocked", errorMessage: msg })
        .where(eq(agentTasks.id, input.dayRootTaskId));

      return { ok: true };
    }),

  /** Retry a failed/blocked campaign stage via the shared agent dispatcher. */
  retryStage: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db.select().from(agentTasks).where(eq(agentTasks.id, input.taskId)).limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (!task.campaignId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Task is not part of a campaign" });
      }
      if (!["pending", "blocked", "failed"].includes(task.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Task is "${task.status}" — nothing to retry`,
        });
      }
      await dispatchTask(task.id, task.agentRole as AgentRole);
      return { ok: true };
    }),
});
