import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { permissionProcedure, router } from "../_core/trpc";
import {
  agentDefinitions,
  agentEvaluations,
  agentEvaluationRuns,
  agentExecutions,
  agentVersions,
  modelPolicies,
  toolPolicies,
} from "../../drizzle/schema";
import { writeAuditLog } from "../_core/auth/audit";
import {
  createAgentWithVersion,
  executeAgentDefinition,
  listAgentUsage,
  publishNewAgentVersion,
  resolveAgent,
  scoreEvaluation,
} from "../services/agent/runtime";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const roleSchema = z.string().min(1).max(64);

export const agentsRouter = router({
  list: permissionProcedure("agent:read").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.organizationId, ctx.organizationId))
      .orderBy(desc(agentDefinitions.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      role: r.role,
      status: r.status,
      currentVersionId: r.currentVersionId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }),

  get: permissionProcedure("agent:read")
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const resolved = await resolveAgent(ctx.organizationId, input.agentId);
        const versions = await ctx.db
          .select()
          .from(agentVersions)
          .where(
            and(
              eq(agentVersions.agentId, input.agentId),
              eq(agentVersions.organizationId, ctx.organizationId),
            ),
          )
          .orderBy(desc(agentVersions.version));

        return {
          id: resolved.agent.id,
          name: resolved.agent.name,
          description: resolved.agent.description,
          role: resolved.agent.role,
          status: resolved.agent.status,
          currentVersionId: resolved.agent.currentVersionId,
          systemPrompt: resolved.systemPrompt,
          capabilities: resolved.capabilities,
          allowedTools: resolved.allowedTools,
          modelPolicy: {
            id: resolved.modelPolicy.id,
            policyKey: resolved.modelPolicy.policyKey,
            preferredProvider: resolved.modelPolicy.preferredProvider,
            preferredModel: resolved.modelPolicy.preferredModel,
            maxTokens: resolved.modelPolicy.maxTokens,
          },
          versions: versions.map((v) => ({
            id: v.id,
            version: v.version,
            changeSummary: v.changeSummary,
            createdAt: v.createdAt.toISOString(),
          })),
          createdAt: resolved.agent.createdAt.toISOString(),
          updatedAt: resolved.agent.updatedAt.toISOString(),
        };
      } catch (err) {
        // Draft agents without a resolvable version still need a basic get.
        const [agent] = await ctx.db
          .select()
          .from(agentDefinitions)
          .where(
            and(
              eq(agentDefinitions.id, input.agentId),
              eq(agentDefinitions.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  create: permissionProcedure("agent:write")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().min(1).max(4000),
        role: roleSchema,
        systemPrompt: z.string().min(1).max(20_000),
        capabilities: z.array(z.string().min(1).max(64)).max(32).optional(),
        allowedTools: z.array(z.string().min(1).max(64)).max(64).optional(),
        preferredProvider: z.string().max(64).nullable().optional(),
        preferredModel: z.string().max(255).nullable().optional(),
        maxTokens: z.number().int().min(64).max(8192).optional(),
        activate: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createAgentWithVersion({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        name: input.name,
        description: input.description,
        role: input.role,
        systemPrompt: input.systemPrompt,
        capabilities: input.capabilities,
        allowedTools: input.allowedTools,
        preferredProvider: input.preferredProvider,
        preferredModel: input.preferredModel,
        maxTokens: input.maxTokens,
        activate: input.activate,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "agent.create",
        resourceType: "agent",
        resourceId: created.agentId,
        payload: { name: input.name, role: input.role },
      });
      return created;
    }),

  publishVersion: permissionProcedure("agent:write")
    .input(
      z.object({
        agentId: z.string().uuid(),
        systemPrompt: z.string().min(1).max(20_000).optional(),
        capabilities: z.array(z.string().min(1).max(64)).max(32).optional(),
        allowedTools: z.array(z.string().min(1).max(64)).max(64).optional(),
        preferredProvider: z.string().max(64).nullable().optional(),
        preferredModel: z.string().max(255).nullable().optional(),
        maxTokens: z.number().int().min(64).max(8192).optional(),
        changeSummary: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await publishNewAgentVersion({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "agent.publish_version",
        resourceType: "agent",
        resourceId: input.agentId,
        payload: { version: result.version },
      });
      return result;
    }),

  setStatus: permissionProcedure("agent:write")
    .input(
      z.object({
        agentId: z.string().uuid(),
        status: z.enum(["draft", "active", "disabled"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agentDefinitions)
        .where(
          and(
            eq(agentDefinitions.id, input.agentId),
            eq(agentDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      await ctx.db
        .update(agentDefinitions)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(agentDefinitions.id, input.agentId));
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "agent.set_status",
        resourceType: "agent",
        resourceId: input.agentId,
        payload: { status: input.status },
      });
      return { ok: true as const };
    }),

  run: permissionProcedure("agent:dispatch")
    .input(
      z.object({
        agentId: z.string().uuid(),
        prompt: z.string().min(1).max(20_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await executeAgentDefinition({
          organizationId: ctx.organizationId,
          agentDefinitionId: input.agentId,
          prompt: input.prompt,
        });
        return {
          executionId: result.executionId,
          text: result.text,
          provider: result.provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
          decisionSummary: result.decisionSummary,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  listExecutions: permissionProcedure("agent:read")
    .input(
      z.object({
        agentId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(agentExecutions.organizationId, ctx.organizationId)];
      if (input.agentId) conditions.push(eq(agentExecutions.agentId, input.agentId));
      const rows = await ctx.db
        .select()
        .from(agentExecutions)
        .where(and(...conditions))
        .orderBy(desc(agentExecutions.createdAt))
        .limit(input.limit);
      return rows.map((r) => ({
        id: r.id,
        agentId: r.agentId,
        agentVersionId: r.agentVersionId,
        status: r.status,
        modelProvider: r.modelProvider,
        modelName: r.modelName,
        decisionSummary: r.decisionSummary,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        error: r.error,
        workflowRunId: r.workflowRunId,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        outputPreview: parseJson<{ text?: string }>(r.output, {}).text?.slice(0, 240) ?? null,
      }));
    }),

  usage: permissionProcedure("agent:read")
    .input(z.object({ agentId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listAgentUsage(ctx.organizationId, input?.agentId);
    }),

  listEvaluations: permissionProcedure("agent:read")
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(agentEvaluations)
        .where(
          and(
            eq(agentEvaluations.agentId, input.agentId),
            eq(agentEvaluations.organizationId, ctx.organizationId),
          ),
        )
        .orderBy(desc(agentEvaluations.createdAt));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        testCase: parseJson(r.testCase, { input: "" }),
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  createEvaluation: permissionProcedure("agent:write")
    .input(
      z.object({
        agentId: z.string().uuid(),
        name: z.string().min(1).max(255),
        input: z.string().min(1).max(10_000),
        expectContains: z.array(z.string().min(1).max(256)).max(20).optional(),
        forbidContains: z.array(z.string().min(1).max(256)).max(20).optional(),
        maxCostUsd: z.number().positive().max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agentDefinitions)
        .where(
          and(
            eq(agentDefinitions.id, input.agentId),
            eq(agentDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });

      const id = randomUUID();
      await ctx.db.insert(agentEvaluations).values({
        id,
        organizationId: ctx.organizationId,
        agentId: input.agentId,
        name: input.name,
        testCase: JSON.stringify({
          input: input.input,
          expectContains: input.expectContains,
          forbidContains: input.forbidContains,
          maxCostUsd: input.maxCostUsd,
        }),
      });
      return { evaluationId: id };
    }),

  runEvaluation: permissionProcedure("agent:dispatch")
    .input(z.object({ evaluationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await scoreEvaluation({
          organizationId: ctx.organizationId,
          evaluationId: input.evaluationId,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  listEvaluationRuns: permissionProcedure("agent:read")
    .input(z.object({ evaluationId: z.string().uuid(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const [evaluation] = await ctx.db
        .select()
        .from(agentEvaluations)
        .where(
          and(
            eq(agentEvaluations.id, input.evaluationId),
            eq(agentEvaluations.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!evaluation) throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });

      const rows = await ctx.db
        .select()
        .from(agentEvaluationRuns)
        .where(
          and(
            eq(agentEvaluationRuns.evaluationId, input.evaluationId),
            eq(agentEvaluationRuns.organizationId, ctx.organizationId),
          ),
        )
        .orderBy(desc(agentEvaluationRuns.createdAt))
        .limit(input.limit);

      return rows.map((r) => ({
        id: r.id,
        passed: Boolean(r.passed),
        score: r.score,
        details: parseJson(r.details, {}),
        agentVersionId: r.agentVersionId,
        agentExecutionId: r.agentExecutionId,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  listPolicies: permissionProcedure("agent:read").query(async ({ ctx }) => {
    const [models, tools] = await Promise.all([
      ctx.db
        .select()
        .from(modelPolicies)
        .where(eq(modelPolicies.organizationId, ctx.organizationId))
        .orderBy(desc(modelPolicies.createdAt))
        .limit(50),
      ctx.db
        .select()
        .from(toolPolicies)
        .where(eq(toolPolicies.organizationId, ctx.organizationId))
        .orderBy(desc(toolPolicies.createdAt))
        .limit(50),
    ]);
    return {
      modelPolicies: models.map((m) => ({
        id: m.id,
        name: m.name,
        policyKey: m.policyKey,
        preferredProvider: m.preferredProvider,
        preferredModel: m.preferredModel,
        maxTokens: m.maxTokens,
      })),
      toolPolicies: tools.map((t) => ({
        id: t.id,
        name: t.name,
        allowedTools: parseJson<string[]>(t.allowedTools, []),
      })),
    };
  }),
});
