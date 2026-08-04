import { createHash, randomUUID } from "crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  agentExecutions,
  agentTasks,
  approvalRequests,
  governancePolicies,
  orgBudgets,
  securityEvents,
} from "../../../drizzle/schema";
import { db } from "../../_core/db";
import { writeAuditLog } from "../../_core/auth/audit";
import { approveWorkflowStep } from "../workflow/runtime";

/** Stable JSON for payload binding — sorted keys, no whitespace variance. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export const DEFAULT_GOVERNANCE_RULES = {
  multiSource: true,
  flagConflict: true,
  pauseUnsupported: true,
  humanReview: true,
  checkStats: true,
  checkQuotes: true,
};

export async function getGovernancePolicy(organizationId: string) {
  const [row] = await db
    .select()
    .from(governancePolicies)
    .where(eq(governancePolicies.organizationId, organizationId))
    .limit(1);
  if (!row) {
    return {
      id: null as string | null,
      rules: DEFAULT_GOVERNANCE_RULES,
      requireHumanReview: true,
      pauseUnsupportedClaims: true,
      updatedAt: null as string | null,
    };
  }
  let rules = DEFAULT_GOVERNANCE_RULES;
  try {
    rules = { ...DEFAULT_GOVERNANCE_RULES, ...(JSON.parse(row.rules) as typeof DEFAULT_GOVERNANCE_RULES) };
  } catch {
    /* keep defaults */
  }
  return {
    id: row.id,
    rules,
    requireHumanReview: row.requireHumanReview,
    pauseUnsupportedClaims: row.pauseUnsupportedClaims,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertGovernancePolicy(params: {
  organizationId: string;
  userId: string;
  rules: Record<string, boolean>;
  requireHumanReview: boolean;
  pauseUnsupportedClaims: boolean;
}) {
  const [existing] = await db
    .select()
    .from(governancePolicies)
    .where(eq(governancePolicies.organizationId, params.organizationId))
    .limit(1);

  if (existing) {
    await db
      .update(governancePolicies)
      .set({
        rules: JSON.stringify(params.rules),
        requireHumanReview: params.requireHumanReview,
        pauseUnsupportedClaims: params.pauseUnsupportedClaims,
        updatedBy: params.userId,
        updatedAt: new Date(),
      })
      .where(eq(governancePolicies.id, existing.id));
    return { policyId: existing.id };
  }

  const id = randomUUID();
  await db.insert(governancePolicies).values({
    id,
    organizationId: params.organizationId,
    rules: JSON.stringify(params.rules),
    requireHumanReview: params.requireHumanReview,
    pauseUnsupportedClaims: params.pauseUnsupportedClaims,
    updatedBy: params.userId,
  });
  return { policyId: id };
}

export async function recordSecurityEvent(params: {
  organizationId?: string | null;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  kind: string;
  message: string;
  actorUserId?: string | null;
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(securityEvents).values({
    id,
    organizationId: params.organizationId ?? null,
    severity: params.severity ?? "info",
    kind: params.kind,
    message: params.message,
    actorUserId: params.actorUserId ?? null,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    payload: params.payload == null ? null : JSON.stringify(params.payload),
  });
  return id;
}

export async function createApprovalRequest(params: {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  title: string;
  summary?: string;
  payload: unknown;
  requestedBy?: string | null;
  expiresAt?: Date | null;
}): Promise<{ approvalId: string; payloadHash: string; deduped: boolean }> {
  // Dedupe: one pending approval per resource
  const [existing] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.organizationId, params.organizationId),
        eq(approvalRequests.resourceType, params.resourceType),
        eq(approvalRequests.resourceId, params.resourceId),
        eq(approvalRequests.status, "pending"),
      ),
    )
    .limit(1);

  const payloadHash = hashPayload(params.payload);
  const payloadJson = canonicalJson(params.payload);

  if (existing) {
    // Refresh bound payload if still pending
    await db
      .update(approvalRequests)
      .set({
        title: params.title,
        summary: params.summary ?? null,
        payload: payloadJson,
        payloadHash,
      })
      .where(eq(approvalRequests.id, existing.id));
    return { approvalId: existing.id, payloadHash, deduped: true };
  }

  const id = randomUUID();
  await db.insert(approvalRequests).values({
    id,
    organizationId: params.organizationId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    title: params.title,
    summary: params.summary ?? null,
    payload: payloadJson,
    payloadHash,
    status: "pending",
    requestedBy: params.requestedBy ?? null,
    expiresAt: params.expiresAt ?? null,
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.requestedBy ?? null,
    action: "approval.requested",
    resourceType: params.resourceType,
    resourceId: params.resourceId.slice(0, 64),
    payload: { approvalId: id, payloadHash },
  });

  return { approvalId: id, payloadHash, deduped: false };
}

export async function decideApproval(params: {
  organizationId: string;
  approvalId: string;
  userId: string;
  decision: "approved" | "rejected";
  note?: string;
  /** Optional current payload to verify binding — if omitted, uses stored payload */
  currentPayload?: unknown;
}): Promise<{ ok: true; resourceType: string; resourceId: string }> {
  const [row] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.id, params.approvalId),
        eq(approvalRequests.organizationId, params.organizationId),
      ),
    )
    .limit(1);

  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Approval request not found" });
  if (row.status !== "pending") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Already ${row.status}` });
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db
      .update(approvalRequests)
      .set({ status: "expired", decidedAt: new Date() })
      .where(eq(approvalRequests.id, row.id));
    await recordSecurityEvent({
      organizationId: params.organizationId,
      severity: "low",
      kind: "approval.expired",
      message: `Approval expired: ${row.title}`,
      actorUserId: params.userId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Approval request expired" });
  }

  if (params.currentPayload !== undefined) {
    const currentHash = hashPayload(params.currentPayload);
    if (currentHash !== row.payloadHash) {
      await recordSecurityEvent({
        organizationId: params.organizationId,
        severity: "high",
        kind: "approval.payload_mismatch",
        message: `Payload binding failed for approval ${row.id}`,
        actorUserId: params.userId,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        payload: { expected: row.payloadHash, actual: currentHash },
      });
      throw new TRPCError({
        code: "CONFLICT",
        message: "Payload changed since approval was requested — binding hash mismatch",
      });
    }
  }

  await db
    .update(approvalRequests)
    .set({
      status: params.decision === "approved" ? "approved" : "rejected",
      decidedBy: params.userId,
      decisionNote: params.note ?? null,
      decidedAt: new Date(),
    })
    .where(eq(approvalRequests.id, row.id));

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: params.decision === "approved" ? "approval.approved" : "approval.rejected",
    resourceType: row.resourceType,
    resourceId: row.resourceId.slice(0, 64),
    payload: { approvalId: row.id, note: params.note },
  });

  if (params.decision === "rejected") {
    await recordSecurityEvent({
      organizationId: params.organizationId,
      severity: "medium",
      kind: "approval.rejected",
      message: `Rejected: ${row.title}`,
      actorUserId: params.userId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    });
  }

  // Dispatch to resource handlers
  if (row.resourceType === "workflow_step") {
    await approveWorkflowStep({
      organizationId: params.organizationId,
      stepRunId: row.resourceId,
      userId: params.userId,
      decision: params.decision,
      note: params.note,
    });
  } else if (row.resourceType === "agent_task") {
    if (params.decision === "approved") {
      await db
        .update(agentTasks)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(eq(agentTasks.id, row.resourceId), eq(agentTasks.organizationId, params.organizationId)),
        );
    } else {
      await db
        .update(agentTasks)
        .set({
          status: "blocked",
          errorMessage: params.note ?? "Rejected by governance approval",
          updatedAt: new Date(),
        })
        .where(
          and(eq(agentTasks.id, row.resourceId), eq(agentTasks.organizationId, params.organizationId)),
        );
    }
  }

  return { ok: true, resourceType: row.resourceType, resourceId: row.resourceId };
}

export async function listApprovals(
  organizationId: string,
  opts?: { status?: "pending" | "approved" | "rejected" | "expired" | "cancelled"; limit?: number },
) {
  const conditions = [eq(approvalRequests.organizationId, organizationId)];
  if (opts?.status) conditions.push(eq(approvalRequests.status, opts.status));
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(and(...conditions))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(opts?.limit ?? 50);

  return rows.map((r) => ({
    id: r.id,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    title: r.title,
    summary: r.summary,
    payloadHash: r.payloadHash,
    status: r.status,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }));
}

function periodStart(period: string): Date {
  const now = new Date();
  if (period === "daily") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === "weekly") {
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === "lifetime") {
    return new Date(0);
  }
  // monthly default
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getOrgSpendUsd(organizationId: string, since: Date): Promise<number> {
  const taskRows = await db
    .select({
      total: sql<string>`coalesce(sum(${agentTasks.costUsd}), 0)`,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.organizationId, organizationId), gte(agentTasks.createdAt, since)));

  const execRows = await db
    .select({
      total: sql<string>`coalesce(sum(${agentExecutions.costUsd}), 0)`,
    })
    .from(agentExecutions)
    .where(
      and(eq(agentExecutions.organizationId, organizationId), gte(agentExecutions.createdAt, since)),
    );

  return Number(taskRows[0]?.total ?? 0) + Number(execRows[0]?.total ?? 0);
}

export async function getBudgetStatus(organizationId: string) {
  const [budget] = await db
    .select()
    .from(orgBudgets)
    .where(eq(orgBudgets.organizationId, organizationId))
    .limit(1);

  if (!budget) {
    return {
      configured: false as const,
      period: null,
      limitUsd: null,
      spentUsd: null,
      remainingUsd: null,
      enforcement: null,
      exceeded: false,
    };
  }

  const since = periodStart(budget.period);
  const spentUsd = await getOrgSpendUsd(organizationId, since);
  const limitUsd = Number(budget.limitUsd);
  const remainingUsd = Math.max(0, limitUsd - spentUsd);

  return {
    configured: true as const,
    period: budget.period,
    limitUsd,
    spentUsd,
    remainingUsd,
    enforcement: budget.enforcement,
    exceeded: spentUsd >= limitUsd,
    since: since.toISOString(),
  };
}

export async function upsertBudget(params: {
  organizationId: string;
  userId: string;
  period: "daily" | "weekly" | "monthly" | "lifetime";
  limitUsd: number;
  enforcement: "soft" | "hard";
}) {
  const [existing] = await db
    .select()
    .from(orgBudgets)
    .where(eq(orgBudgets.organizationId, params.organizationId))
    .limit(1);

  if (existing) {
    await db
      .update(orgBudgets)
      .set({
        period: params.period,
        limitUsd: String(params.limitUsd),
        enforcement: params.enforcement,
        updatedBy: params.userId,
        updatedAt: new Date(),
      })
      .where(eq(orgBudgets.id, existing.id));
    return { budgetId: existing.id };
  }

  const id = randomUUID();
  await db.insert(orgBudgets).values({
    id,
    organizationId: params.organizationId,
    period: params.period,
    limitUsd: String(params.limitUsd),
    enforcement: params.enforcement,
    updatedBy: params.userId,
  });
  return { budgetId: id };
}

/**
 * Returns allow=false when hard budget exceeded.
 * Soft overage records a security event but still allows.
 */
export async function assertBudgetAllows(
  organizationId: string,
  actorUserId?: string | null,
): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getBudgetStatus(organizationId);
  if (!status.configured || !status.exceeded) return { allowed: true };

  await recordSecurityEvent({
    organizationId,
    severity: status.enforcement === "hard" ? "high" : "medium",
    kind: "budget.exceeded",
    message: `Org budget exceeded (${status.spentUsd?.toFixed(4)} / ${status.limitUsd} USD, ${status.period})`,
    actorUserId: actorUserId ?? null,
    resourceType: "org_budget",
    payload: status,
  });

  if (status.enforcement === "hard") {
    return {
      allowed: false,
      reason: `Hard budget exceeded: spent $${status.spentUsd?.toFixed(4)} of $${status.limitUsd} (${status.period})`,
    };
  }
  return { allowed: true, reason: "Soft budget exceeded — allowed with security event" };
}

export async function listSecurityEvents(organizationId: string, limit = 50) {
  const rows = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.organizationId, organizationId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    severity: r.severity,
    kind: r.kind,
    message: r.message,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    createdAt: r.createdAt.toISOString(),
  }));
}
