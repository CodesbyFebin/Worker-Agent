import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { claimLedger, contentOpsPipelines, scripts } from "../../drizzle/schema";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  STAGE_WORKSPACE,
  advancePipeline,
  startContentPipeline,
  type PipelineStage,
} from "../services/pipeline/contentOpsPipeline";
import { extractClaims } from "../services/verification/claimValidator";
import { startCampaign } from "../_core/youtube-automode";

function toDTO(row: typeof contentOpsPipelines.$inferSelect) {
  const stage = row.stage as PipelineStage;
  return {
    id: row.id,
    scriptId: row.scriptId,
    rootTaskId: row.rootTaskId,
    campaignId: row.campaignId,
    title: row.title,
    stage,
    stageLabel: STAGE_LABEL[stage],
    workspaceId: stage === "done" ? null : STAGE_WORKSPACE[stage],
    stages: PIPELINE_STAGES.filter((s) => s !== "done").map((s) => ({
      id: s,
      label: STAGE_LABEL[s],
      workspaceId: STAGE_WORKSPACE[s],
      current: s === stage,
      done: PIPELINE_STAGES.indexOf(s) < PIPELINE_STAGES.indexOf(stage),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Content Ops pipeline: God Machine → Script Studio → Evidence → …
 */
export const pipelineRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(contentOpsPipelines)
      .where(eq(contentOpsPipelines.userId, ctx.userId!))
      .orderBy(desc(contentOpsPipelines.updatedAt));
    return rows.map(toDTO);
  }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(contentOpsPipelines)
      .where(eq(contentOpsPipelines.userId, ctx.userId!))
      .orderBy(desc(contentOpsPipelines.updatedAt))
      .limit(1);
    return row ? toDTO(row) : null;
  }),

  getById: protectedProcedure
    .input(z.object({ pipelineId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(contentOpsPipelines)
        .where(
          and(eq(contentOpsPipelines.id, input.pipelineId), eq(contentOpsPipelines.userId, ctx.userId!)),
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      return toDTO(row);
    }),

  getByScript: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(contentOpsPipelines)
        .where(
          and(eq(contentOpsPipelines.scriptId, input.scriptId), eq(contentOpsPipelines.userId, ctx.userId!)),
        )
        .orderBy(desc(contentOpsPipelines.updatedAt))
        .limit(1);
      return row ? toDTO(row) : null;
    }),

  /** Move to next stage and run stage side-effects (claims extract / campaign start). */
  advance: protectedProcedure
    .input(z.object({ pipelineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await advancePipeline({
        pipelineId: input.pipelineId,
        userId: ctx.userId!,
      });

      const [pipe] = await ctx.db
        .select()
        .from(contentOpsPipelines)
        .where(eq(contentOpsPipelines.id, input.pipelineId))
        .limit(1);

      if (!pipe) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });

      // Side effects when entering a stage
      if (result.stage === "evidence") {
        const [script] = await ctx.db
          .select()
          .from(scripts)
          .where(eq(scripts.id, pipe.scriptId))
          .limit(1);
        if (script?.fullText.trim()) {
          try {
            const claims = await extractClaims(script.fullText);
            for (const c of claims.slice(0, 12)) {
              await ctx.db.insert(claimLedger).values({
                id: randomUUID(),
                scriptId: script.id,
                devtag: `pipe-${script.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`,
                claimText: c.claimText,
                sourceUrl: null,
                confidenceScore: c.confidenceScore.toFixed(3),
                verificationStatus: "pending",
                isImmutable: true,
                createdAt: new Date(),
              });
            }
          } catch (err) {
            console.warn("[pipeline] claim extract failed:", (err as Error).message);
          }
        }
      }

      if (result.stage === "youtube_autopilot" && !pipe.campaignId) {
        const [script] = await ctx.db
          .select()
          .from(scripts)
          .where(eq(scripts.id, pipe.scriptId))
          .limit(1);
        if (script) {
          try {
            const started = await startCampaign({
              userId: ctx.userId!,
              topic: script.title,
              totalDays: 7,
              startDate: new Date(),
            });
            await ctx.db
              .update(contentOpsPipelines)
              .set({ campaignId: started.campaignId, updatedAt: new Date() })
              .where(eq(contentOpsPipelines.id, pipe.id));
          } catch (err) {
            console.warn("[pipeline] campaign start failed:", (err as Error).message);
          }
        }
      }

      const [fresh] = await ctx.db
        .select()
        .from(contentOpsPipelines)
        .where(eq(contentOpsPipelines.id, input.pipelineId))
        .limit(1);

      return {
        ...toDTO(fresh!),
        advancedTo: result.stage,
        workspaceId: result.workspaceId,
      };
    }),

  /** Manual create (e.g. from Script Studio without God Machine). */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scriptId: z.string().uuid().optional(),
        stage: z
          .enum([
            "god_machine",
            "script_studio",
            "evidence",
            "research_to_post",
            "workspace",
            "youtube_autopilot",
            "social",
            "approvals",
            "publishing",
            "done",
          ])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.scriptId) {
        const id = randomUUID();
        const now = new Date();
        await ctx.db.insert(contentOpsPipelines).values({
          id,
          userId: ctx.userId!,
          scriptId: input.scriptId,
          rootTaskId: null,
          campaignId: null,
          title: input.title,
          stage: input.stage ?? "script_studio",
          createdAt: now,
          updatedAt: now,
        });
        const [row] = await ctx.db
          .select()
          .from(contentOpsPipelines)
          .where(eq(contentOpsPipelines.id, id))
          .limit(1);
        return toDTO(row!);
      }
      const started = await startContentPipeline({
        userId: ctx.userId!,
        title: input.title,
        goal: input.title,
      });
      const [row] = await ctx.db
        .select()
        .from(contentOpsPipelines)
        .where(eq(contentOpsPipelines.id, started.pipelineId))
        .limit(1);
      return toDTO(row!);
    }),
});
