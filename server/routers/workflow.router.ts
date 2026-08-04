import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { permissionProcedure, router } from "../_core/trpc";
import {
  workflowDefinitions,
  workflowRuns,
  workflowStepRuns,
  workflowVersions,
} from "../../drizzle/schema";
import {
  compileWorkflowGraph,
  defaultManualWorkflowGraph,
  hasCompileErrors,
  workflowGraphSchema,
  type WorkflowGraph,
} from "../services/workflow/types";
import {
  approveWorkflowStep,
  cancelWorkflowRun,
  startWorkflowRun,
} from "../services/workflow/runtime";
import { listWorkflowEvents } from "../services/workflow/events";
import { writeAuditLog } from "../_core/auth/audit";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const workflowRouter = router({
  list: permissionProcedure("workflow:read").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.organizationId, ctx.organizationId))
      .orderBy(desc(workflowDefinitions.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      currentVersionId: r.currentVersionId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }),

  get: permissionProcedure("workflow:read")
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [wf] = await ctx.db
        .select()
        .from(workflowDefinitions)
        .where(
          and(
            eq(workflowDefinitions.id, input.workflowId),
            eq(workflowDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!wf) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      let version = null;
      if (wf.currentVersionId) {
        const [v] = await ctx.db
          .select()
          .from(workflowVersions)
          .where(eq(workflowVersions.id, wf.currentVersionId))
          .limit(1);
        if (v) {
          const graph = parseJson<WorkflowGraph>(v.graph, { nodes: [], edges: [] });
          const compiled = compileWorkflowGraph(graph);
          version = {
            id: v.id,
            version: v.version,
            graph,
            changeSummary: v.changeSummary,
            issues: compiled.issues,
            createdAt: v.createdAt.toISOString(),
          };
        }
      }

      return {
        id: wf.id,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        currentVersionId: wf.currentVersionId,
        version,
        createdAt: wf.createdAt.toISOString(),
        updatedAt: wf.updatedAt.toISOString(),
      };
    }),

  create: permissionProcedure("workflow:write")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        graph: workflowGraphSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflowId = randomUUID();
      const versionId = randomUUID();
      const now = new Date();
      const graph = input.graph ?? defaultManualWorkflowGraph(input.name);
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

      await ctx.db.insert(workflowDefinitions).values({
        id: workflowId,
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description ?? null,
        currentVersionId: versionId,
        status: "draft",
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert(workflowVersions).values({
        id: versionId,
        workflowId,
        organizationId: ctx.organizationId,
        version: 1,
        graph: JSON.stringify(graph),
        inputSchema: JSON.stringify({
          type: "object",
          properties: { goal: { type: "string" } },
        }),
        outputSchema: null,
        changeSummary: "Initial draft",
        createdBy: ctx.userId,
        createdAt: now,
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "workflow.created",
        resourceType: "workflow",
        resourceId: workflowId,
      });

      return { workflowId, versionId };
    }),

  saveDraft: permissionProcedure("workflow:write")
    .input(
      z.object({
        workflowId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        graph: workflowGraphSchema,
        changeSummary: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wf] = await ctx.db
        .select()
        .from(workflowDefinitions)
        .where(
          and(
            eq(workflowDefinitions.id, input.workflowId),
            eq(workflowDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!wf) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      const compiled = compileWorkflowGraph(input.graph);
      if (hasCompileErrors(compiled)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: compiled.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; "),
        });
      }

      const versions = await ctx.db
        .select()
        .from(workflowVersions)
        .where(eq(workflowVersions.workflowId, wf.id))
        .orderBy(desc(workflowVersions.version))
        .limit(1);
      const nextVersion = (versions[0]?.version ?? 0) + 1;
      const versionId = randomUUID();
      const now = new Date();

      await ctx.db.insert(workflowVersions).values({
        id: versionId,
        workflowId: wf.id,
        organizationId: ctx.organizationId,
        version: nextVersion,
        graph: JSON.stringify(input.graph),
        inputSchema: versions[0]?.inputSchema ?? null,
        outputSchema: versions[0]?.outputSchema ?? null,
        changeSummary: input.changeSummary ?? `Draft v${nextVersion}`,
        createdBy: ctx.userId,
        createdAt: now,
      });

      await ctx.db
        .update(workflowDefinitions)
        .set({
          currentVersionId: versionId,
          name: input.name ?? wf.name,
          description: input.description ?? wf.description,
          status: "draft",
          updatedAt: now,
        })
        .where(eq(workflowDefinitions.id, wf.id));

      return { versionId, version: nextVersion, issues: compiled.issues };
    }),

  publish: permissionProcedure("workflow:write")
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [wf] = await ctx.db
        .select()
        .from(workflowDefinitions)
        .where(
          and(
            eq(workflowDefinitions.id, input.workflowId),
            eq(workflowDefinitions.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!wf?.currentVersionId) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      const [v] = await ctx.db
        .select()
        .from(workflowVersions)
        .where(eq(workflowVersions.id, wf.currentVersionId))
        .limit(1);
      if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      const compiled = compileWorkflowGraph(parseJson(v.graph, { nodes: [], edges: [] }));
      if (hasCompileErrors(compiled)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot publish invalid graph",
        });
      }

      await ctx.db
        .update(workflowDefinitions)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(workflowDefinitions.id, wf.id));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "workflow.published",
        resourceType: "workflow",
        resourceId: wf.id,
      });

      return { ok: true as const };
    }),

  startRun: permissionProcedure("workflow:write")
    .input(
      z.object({
        workflowId: z.string().uuid(),
        input: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await startWorkflowRun({
          organizationId: ctx.organizationId,
          workflowId: input.workflowId,
          userId: ctx.userId,
          input: input.input ?? {},
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  listRuns: permissionProcedure("workflow:read")
    .input(
      z
        .object({
          workflowId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const rows = input?.workflowId
        ? await ctx.db
            .select()
            .from(workflowRuns)
            .where(
              and(
                eq(workflowRuns.organizationId, ctx.organizationId),
                eq(workflowRuns.workflowId, input.workflowId),
              ),
            )
            .orderBy(desc(workflowRuns.createdAt))
            .limit(limit)
        : await ctx.db
            .select()
            .from(workflowRuns)
            .where(eq(workflowRuns.organizationId, ctx.organizationId))
            .orderBy(desc(workflowRuns.createdAt))
            .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        workflowId: r.workflowId,
        workflowVersionId: r.workflowVersionId,
        status: r.status,
        triggerType: r.triggerType,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  getRun: permissionProcedure("workflow:read")
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(
          and(eq(workflowRuns.id, input.runId), eq(workflowRuns.organizationId, ctx.organizationId)),
        )
        .limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

      const steps = await ctx.db
        .select()
        .from(workflowStepRuns)
        .where(eq(workflowStepRuns.workflowRunId, run.id));

      const events = await listWorkflowEvents(run.id, ctx.organizationId, 100);

      return {
        id: run.id,
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId,
        status: run.status,
        triggerType: run.triggerType,
        input: parseJson(run.input, {}),
        output: parseJson(run.output, null),
        errorMessage: run.errorMessage,
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        steps: steps.map((s) => ({
          id: s.id,
          nodeId: s.nodeId,
          nodeType: s.nodeType,
          name: s.name,
          status: s.status,
          attempt: s.attempt,
          input: parseJson(s.input, null),
          output: parseJson(s.output, null),
          errorMessage: s.errorMessage,
          decisionSummary: s.decisionSummary,
          startedAt: s.startedAt?.toISOString() ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
        })),
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          message: e.message,
          stepRunId: e.stepRunId,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    }),

  approveStep: permissionProcedure("workflow:write")
    .input(
      z.object({
        stepRunId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await approveWorkflowStep({
          organizationId: ctx.organizationId,
          stepRunId: input.stepRunId,
          userId: ctx.userId,
          decision: input.decision,
          note: input.note,
        });
        return { ok: true as const };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  cancelRun: permissionProcedure("workflow:write")
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await cancelWorkflowRun({ organizationId: ctx.organizationId, runId: input.runId });
      return { ok: true as const };
    }),

  validateGraph: permissionProcedure("workflow:read")
    .input(z.object({ graph: workflowGraphSchema }))
    .query(({ input }) => {
      const compiled = compileWorkflowGraph(input.graph);
      return { issues: compiled.issues, ok: !hasCompileErrors(compiled) };
    }),
});
