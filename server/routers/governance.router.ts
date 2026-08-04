import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../_core/auth/audit";
import { agentTasks, auditLogs, workflowStepRuns } from "../../drizzle/schema";
import {
  assertBudgetAllows,
  createApprovalRequest,
  decideApproval,
  DEFAULT_GOVERNANCE_RULES,
  getBudgetStatus,
  getGovernancePolicy,
  listApprovals,
  listSecurityEvents,
  upsertBudget,
  upsertGovernancePolicy,
} from "../services/governance/engine";

export const governanceRouter = router({
  getPolicy: permissionProcedure("approval:read").query(async ({ ctx }) => {
    return getGovernancePolicy(ctx.organizationId);
  }),

  setPolicy: permissionProcedure("governance:write")
    .input(
      z.object({
        rules: z.record(z.boolean()).default(DEFAULT_GOVERNANCE_RULES),
        requireHumanReview: z.boolean(),
        pauseUnsupportedClaims: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await upsertGovernancePolicy({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        rules: { ...DEFAULT_GOVERNANCE_RULES, ...input.rules },
        requireHumanReview: input.requireHumanReview,
        pauseUnsupportedClaims: input.pauseUnsupportedClaims,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "governance.policy_update",
        resourceType: "governance_policy",
        resourceId: result.policyId,
        payload: input,
      });
      return result;
    }),

  listApprovals: permissionProcedure("approval:read")
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected", "expired", "cancelled"]).optional(),
          limit: z.number().int().min(1).max(100).default(40),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listApprovals(ctx.organizationId, input);
    }),

  /** Pull awaiting workflow steps + agent tasks into the unified approval queue. */
  syncApprovals: permissionProcedure("approval:decide").mutation(async ({ ctx }) => {
    let created = 0;

    const steps = await ctx.db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.organizationId, ctx.organizationId),
          eq(workflowStepRuns.status, "awaiting_approval"),
        ),
      )
      .limit(100);

    for (const step of steps) {
      let payload: unknown = null;
      try {
        payload = step.output ? JSON.parse(step.output) : { stepId: step.id };
      } catch {
        payload = { raw: step.output };
      }
      const r = await createApprovalRequest({
        organizationId: ctx.organizationId,
        resourceType: "workflow_step",
        resourceId: step.id,
        title: `Workflow: ${step.name}`,
        summary: step.decisionSummary ?? undefined,
        payload,
        requestedBy: ctx.userId,
      });
      if (!r.deduped) created += 1;
    }

    const tasks = await ctx.db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.organizationId, ctx.organizationId),
          eq(agentTasks.status, "awaiting_approval"),
        ),
      )
      .limit(100);

    for (const task of tasks) {
      const payload: Record<string, unknown> = { title: task.title, role: task.agentRole };
      try {
        if (task.result) payload.result = JSON.parse(task.result);
        if (task.payload) payload.taskPayload = JSON.parse(task.payload);
      } catch {
        /* keep base */
      }
      const r = await createApprovalRequest({
        organizationId: ctx.organizationId,
        resourceType: "agent_task",
        resourceId: task.id,
        title: task.title,
        summary: `${task.agentRole} · awaiting_approval`,
        payload,
        requestedBy: ctx.userId,
      });
      if (!r.deduped) created += 1;
    }

    return { created, scannedSteps: steps.length, scannedTasks: tasks.length };
  }),

  decide: permissionProcedure("approval:decide")
    .input(
      z.object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return decideApproval({
        organizationId: ctx.organizationId,
        approvalId: input.approvalId,
        userId: ctx.userId,
        decision: input.decision,
        note: input.note,
      });
    }),

  createCustomApproval: permissionProcedure("approval:decide")
    .input(
      z.object({
        title: z.string().min(1).max(512),
        summary: z.string().max(4000).optional(),
        payload: z.record(z.unknown()),
        resourceId: z.string().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createApprovalRequest({
        organizationId: ctx.organizationId,
        resourceType: "custom",
        resourceId: input.resourceId ?? randomUUID(),
        title: input.title,
        summary: input.summary,
        payload: input.payload,
        requestedBy: ctx.userId,
      });
    }),

  getBudget: permissionProcedure("approval:read").query(async ({ ctx }) => {
    return getBudgetStatus(ctx.organizationId);
  }),

  setBudget: permissionProcedure("governance:write")
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly", "lifetime"]),
        limitUsd: z.number().positive().max(1_000_000),
        enforcement: z.enum(["soft", "hard"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await upsertBudget({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "governance.budget_update",
        resourceType: "org_budget",
        resourceId: result.budgetId,
        payload: input,
      });
      return result;
    }),

  checkBudget: permissionProcedure("approval:read").query(async ({ ctx }) => {
    return assertBudgetAllows(ctx.organizationId, ctx.userId);
  }),

  listSecurityEvents: permissionProcedure("audit:read")
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      return listSecurityEvents(ctx.organizationId, input?.limit ?? 40);
    }),

  listAudit: permissionProcedure("audit:read")
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, ctx.organizationId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(input?.limit ?? 40);
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        payload: r.payload ? (JSON.parse(r.payload) as unknown) : null,
        actorUserId: r.actorUserId,
        createdAt: r.createdAt.toISOString(),
      }));
    }),
});
