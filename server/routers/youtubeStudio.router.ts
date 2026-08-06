import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { permissionProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../_core/auth/audit";
import { compileWorkflowGraph, hasCompileErrors, youtubeLongFormTemplate } from "../services/workflow/types";
import { startWorkflowRun } from "../services/workflow/runtime";
import {
  computeStaggeredSchedule,
  createVideoDraft,
  ensureYoutubeScriptwriterAgent,
  generateYoutubeScript,
  listChannels,
  listRecentTrends,
  listVideos,
  runComplianceScan,
  searchTrends,
  upsertChannel,
} from "../services/youtube/studio";
import { db } from "../_core/db";
import { workflowDefinitions, workflowVersions } from "../../drizzle/schema";

export const youtubeStudioRouter = router({
  listChannels: permissionProcedure("youtube:read").query(async ({ ctx }) => {
    return listChannels(ctx.organizationId);
  }),

  upsertChannel: permissionProcedure("youtube:write")
    .input(
      z.object({
        channelName: z.string().min(1).max(255),
        youtubeChannelId: z.string().max(64).optional(),
        accessTokenEnvKey: z.string().min(1).max(128),
        refreshTokenEnvKey: z.string().max(128).optional(),
        timezone: z.string().max(64).optional(),
        niche: z.string().max(255).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await upsertChannel({
        organizationId: ctx.organizationId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "youtube.channel_upsert",
        resourceType: "youtube_channel",
        resourceId: id,
        payload: { channelName: input.channelName, accessTokenEnvKey: input.accessTokenEnvKey },
      });
      return { id };
    }),

  listVideos: permissionProcedure("youtube:read")
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => listVideos(ctx.organizationId, input?.limit)),

  searchTrends: permissionProcedure("youtube:read")
    .input(z.object({ query: z.string().min(2).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await searchTrends({ organizationId: ctx.organizationId, query: input.query });
      } catch (err) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  listTrends: permissionProcedure("youtube:read")
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => listRecentTrends(ctx.organizationId, input?.limit)),

  ensureScriptwriter: permissionProcedure("youtube:write").mutation(async ({ ctx }) => {
    const agent = await ensureYoutubeScriptwriterAgent(ctx.organizationId, ctx.userId);
    return { agentId: agent.id, role: agent.role };
  }),

  generateScript: permissionProcedure("youtube:write")
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        tone: z.string().max(120).optional(),
        lengthMinutes: z.number().int().min(3).max(30).default(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return generateYoutubeScript({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        topic: input.topic,
        tone: input.tone,
        lengthMinutes: input.lengthMinutes,
      });
    }),

  scanCompliance: permissionProcedure("youtube:read")
    .input(z.object({ script: z.string().min(1).max(100_000) }))
    .mutation(({ input }) => runComplianceScan(input.script)),

  longFormTemplate: permissionProcedure("youtube:read").query(() => youtubeLongFormTemplate()),

  seedLongFormWorkflow: permissionProcedure("youtube:write")
    .input(
      z.object({
        name: z.string().min(1).max(255).default("YouTube Long Form"),
        topicHint: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflowId = randomUUID();
      const versionId = randomUUID();
      const now = new Date();
      const graph = youtubeLongFormTemplate(input.topicHint ? input.topicHint : "{{input.topic}}");
      const compiled = compileWorkflowGraph(graph);
      if (hasCompileErrors(compiled)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: compiled.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; "),
        });
      }

      await db.insert(workflowDefinitions).values({
        id: workflowId,
        organizationId: ctx.organizationId,
        name: input.name,
        description:
          "YouTube long-form pipeline (script → compliance → voice/broll → assemble → upload)",
        currentVersionId: null,
        status: "published",
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workflowVersions).values({
        id: versionId,
        workflowId,
        organizationId: ctx.organizationId,
        version: 1,
        graph: JSON.stringify(graph),
        changeSummary: "YouTube long-form template",
        createdBy: ctx.userId,
        createdAt: now,
      });
      await db
        .update(workflowDefinitions)
        .set({ currentVersionId: versionId, updatedAt: now })
        .where(eq(workflowDefinitions.id, workflowId));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "youtube.workflow_seeded",
        resourceType: "workflow",
        resourceId: workflowId,
      });
      return { workflowId, versionId, graph };
    }),

  batchPublish: permissionProcedure("youtube:publish")
    .input(
      z.object({
        workflowDefinitionId: z.string().uuid(),
        topics: z.array(z.string().min(3).max(500)).min(1).max(10),
        channelId: z.string().uuid().optional(),
        staggerMinutes: z.number().int().min(0).max(1440).default(45),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wf] = await db
        .select()
        .from(workflowDefinitions)
        .where(
          and(
            eq(workflowDefinitions.id, input.workflowDefinitionId),
            eq(workflowDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!wf) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      const channels = await listChannels(ctx.organizationId);
      const channel = input.channelId
        ? channels.find((c) => c.id === input.channelId)
        : channels[0];
      if (!channel) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No YouTube channel bound for this organization",
        });
      }

      const runs: Array<{ topic: string; runId: string; scheduledAt: string }> = [];
      for (let i = 0; i < input.topics.length; i++) {
        const topic = input.topics[i]!;
        const scheduledAt = computeStaggeredSchedule(channel.timezone, i * input.staggerMinutes);
        const { runId } = await startWorkflowRun({
          organizationId: ctx.organizationId,
          workflowId: wf.id,
          userId: ctx.userId,
          input: {
            topic,
            goal: topic,
            channelId: channel.id,
            scheduledAt: scheduledAt.toISOString(),
          },
        });
        await createVideoDraft({
          organizationId: ctx.organizationId,
          channelId: channel.id,
          title: topic.slice(0, 100),
          topic,
          workflowRunId: runId,
        });
        runs.push({ topic, runId, scheduledAt: scheduledAt.toISOString() });
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "youtube.batch_publish",
        resourceType: "workflow",
        resourceId: wf.id,
        payload: { count: runs.length },
      });

      return { runs };
    }),
});
