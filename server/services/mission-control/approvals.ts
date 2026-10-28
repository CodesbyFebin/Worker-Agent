import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { auditLogs } from "../../../drizzle/schema";
import {
  computeApprovalGateKey,
  computeEvaluationRevision,
  computeSubjectDigest,
  type GovernanceArtifactSnapshot,
  type GovernanceClaimSnapshot,
} from "./governance";
import { appendDurableEvent } from "./outbox";
import { mcAgentTasks, mcWorkflowRuns, missionControlApprovals } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ApprovalRow = typeof missionControlApprovals.$inferSelect;
type TaskRow = typeof mcAgentTasks.$inferSelect;
type RunRow = typeof mcWorkflowRuns.$inferSelect;

export interface ResolveMissionControlApprovalInput {
  approvalId: string;
  decision: "approved" | "rejected";
  resolvedBy: string;
  /** Server-derived active organization. Never trust a client organization id. */
  organizationId: string;
  decisionNote?: string;
  currentClaims: GovernanceClaimSnapshot[];
  currentArtifacts: GovernanceArtifactSnapshot[];
  projectedAction: string;
}

function traceIdFor(run: RunRow): string {
  return run.traceId ?? `trc_legacy_${run.id}`;
}

async function writeAudit(
  tx: Tx,
  params: {
    organizationId: string;
    actorUserId: string;
    action: string;
    approvalId: string;
    payload: unknown;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: params.action,
    resourceType: "mission_control_approval",
    resourceId: params.approvalId,
    payload: JSON.stringify(params.payload),
  });
}

async function supersedeStaleGate(
  tx: Tx,
  params: {
    approval: ApprovalRow;
    task: TaskRow;
    run: RunRow;
    input: ResolveMissionControlApprovalInput;
    evaluationRevision: string;
    subjectDigest: string;
    currentGateKey: string;
  },
): Promise<string> {
  const { approval, task, run, input, evaluationRevision, subjectDigest, currentGateKey } = params;
  const now = new Date();

  await tx
    .update(missionControlApprovals)
    .set({
      status: "superseded",
      resolvedAt: now,
      resolvedBy: input.resolvedBy,
      decisionNote: "Reviewed state changed; prior gate superseded",
    })
    .where(eq(missionControlApprovals.id, approval.id));

  const [alreadyCurrent] = await tx
    .select()
    .from(missionControlApprovals)
    .where(eq(missionControlApprovals.approvalGateKey, currentGateKey))
    .limit(1);

  const freshApprovalId = alreadyCurrent?.id ?? randomUUID();
  if (!alreadyCurrent) {
    await tx.insert(missionControlApprovals).values({
      id: freshApprovalId,
      approvalGateKey: currentGateKey,
      organizationId: approval.organizationId,
      taskId: approval.taskId,
      runId: run.id,
      type: approval.type,
      status: "pending",
      reason: "Reviewed state changed; re-approval required",
      reasons: JSON.stringify(["Reviewed state changed after the prior gate was created"]),
      policyVersion: approval.policyVersion,
      policyRuleId: approval.policyRuleId,
      evaluationRevision,
      subjectDigest,
      requestedBy: approval.requestedBy,
    });
  }

  await tx
    .update(mcAgentTasks)
    .set({ status: "awaiting_approval", updatedAt: now })
    .where(eq(mcAgentTasks.id, task.id));

  await appendDurableEvent(tx, {
    organizationId: approval.organizationId,
    aggregateType: "approval",
    aggregateId: approval.id,
    aggregateVersion: 2,
    eventType: "approval.superseded",
    traceId: traceIdFor(run),
    payload: {
      staleApprovalId: approval.id,
      freshApprovalId,
      runId: run.id,
      taskId: task.id,
    },
  });

  await writeAudit(tx, {
    organizationId: approval.organizationId,
    actorUserId: input.resolvedBy,
    action: "mc.approval.superseded",
    approvalId: approval.id,
    payload: { freshApprovalId, taskId: task.id, runId: run.id },
  });

  return freshApprovalId;
}

export async function resolveMissionControlApproval(input: ResolveMissionControlApprovalInput) {
  const outcome = await db.transaction(async (tx) => {
    const [approval] = await tx
      .select()
      .from(missionControlApprovals)
      .where(eq(missionControlApprovals.id, input.approvalId))
      .for("update");

    if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found" });
    if (approval.organizationId !== input.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cross-organization approval access" });
    }
    if (approval.status !== "pending") {
      throw new TRPCError({ code: "CONFLICT", message: `Approval already ${approval.status}` });
    }
    if (!approval.runId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval has no run linkage" });
    }

    const [task] = await tx
      .select()
      .from(mcAgentTasks)
      .where(eq(mcAgentTasks.id, approval.taskId))
      .for("update");
    if (!task) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval references missing task" });
    }
    if (task.organizationId !== input.organizationId || task.runId !== approval.runId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Approval/task/run integrity violation",
      });
    }

    const [run] = await tx
      .select()
      .from(mcWorkflowRuns)
      .where(eq(mcWorkflowRuns.id, approval.runId))
      .for("update");
    if (!run) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval references missing run" });
    }
    if (run.organizationId !== input.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cross-organization run access" });
    }

    const evaluationRevision = computeEvaluationRevision({
      claims: input.currentClaims,
      artifacts: input.currentArtifacts,
      policyVersion: approval.policyVersion,
    });
    const subjectDigest = computeSubjectDigest({
      task: {
        id: task.id,
        runId: task.runId,
        title: task.title,
        assignedRole: task.agentRole,
      },
      claims: input.currentClaims,
      artifacts: input.currentArtifacts,
      policyVersion: approval.policyVersion,
      projectedAction: input.projectedAction,
    });
    const currentGateKey = computeApprovalGateKey({
      runId: run.id,
      taskId: task.id,
      policyVersion: approval.policyVersion,
      policyRuleId: approval.policyRuleId,
      evaluationRevision,
      subjectDigest,
    });

    if (currentGateKey !== approval.approvalGateKey) {
      const freshApprovalId = await supersedeStaleGate(tx, {
        approval,
        task,
        run,
        input,
        evaluationRevision,
        subjectDigest,
        currentGateKey,
      });
      // Return a sentinel so the transaction COMMITS. The conflict is raised outside.
      return { kind: "stale" as const, freshApprovalId };
    }

    const now = new Date();
    await tx
      .update(missionControlApprovals)
      .set({
        status: input.decision,
        resolvedAt: now,
        resolvedBy: input.resolvedBy,
        decisionNote: input.decisionNote ?? null,
      })
      .where(eq(missionControlApprovals.id, approval.id));

    await tx
      .update(mcAgentTasks)
      .set({
        status: input.decision === "approved" ? "ready" : "blocked",
        updatedAt: now,
      })
      .where(eq(mcAgentTasks.id, task.id));

    await appendDurableEvent(tx, {
      organizationId: approval.organizationId,
      aggregateType: "approval",
      aggregateId: approval.id,
      aggregateVersion: 1,
      eventType: input.decision === "approved" ? "approval.approved" : "approval.rejected",
      traceId: traceIdFor(run),
      payload: {
        approvalId: approval.id,
        runId: run.id,
        taskId: task.id,
        decision: input.decision,
        resolvedBy: input.resolvedBy,
      },
    });

    await writeAudit(tx, {
      organizationId: approval.organizationId,
      actorUserId: input.resolvedBy,
      action: input.decision === "approved" ? "mc.approval.granted" : "mc.approval.rejected",
      approvalId: approval.id,
      payload: { taskId: task.id, runId: run.id, gateKey: approval.approvalGateKey },
    });

    return { kind: "resolved" as const, approvalId: approval.id, decision: input.decision };
  });

  if (outcome.kind === "stale") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `APPROVAL_STALE: fresh approval ${outcome.freshApprovalId} created`,
    });
  }

  return { approvalId: outcome.approvalId, decision: outcome.decision };
}
