import { randomUUID } from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../_core/db";
import { governancePolicies, orgBudgets, organizationMembers, securityEvents, users, roles } from "../../../drizzle/schema";
import { recordSecurityEvent, DEFAULT_GOVERNANCE_RULES } from "./engine";

export type PolicyRule = {
  key: string;
  description: string;
  enforce: boolean;
  severity: "info" | "low" | "medium" | "high" | "critical";
  predicate: (ctx: PolicyContext) => PolicyDecision | Promise<PolicyDecision>;
};

export type PolicyContext = {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  payload?: unknown;
};

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export const BUILTIN_POLICIES: PolicyRule[] = [
  {
    key: "budget.hard_limit",
    description: "Hard budget enforcement blocks spend when exceeded",
    enforce: true,
    severity: "high",
    predicate: async (ctx: PolicyContext): Promise<PolicyDecision> => {
      if (ctx.action !== "agent.execution.started") return { allowed: true };
      const [budget] = await db.select().from(orgBudgets).where(eq(orgBudgets.organizationId, ctx.organizationId)).limit(1);
      if (!budget || budget.enforcement !== "hard") return { allowed: true };
      const { getOrgSpendUsd } = await import("./engine");
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const spent = await getOrgSpendUsd(ctx.organizationId, since);
      const limit = Number(budget.limitUsd);
      if (spent >= limit) {
        return {
          allowed: false,
          reason: `Hard budget exceeded: $${spent.toFixed(4)} / $${limit}`,
          metadata: { spent, limit },
        };
      }
      return { allowed: true };
    },
  },
  {
    key: "workflow.approval_required",
    description: "Require approval for workflow.publish actions",
    enforce: true,
    severity: "medium",
    predicate: (ctx: PolicyContext): PolicyDecision => {
      if (ctx.action !== "workflow.publish.started") return { allowed: true };
      return { allowed: false, reason: "workflow.publish.started requires explicit approval policy", metadata: {} };
    },
  },
  {
    key: "member.max_admins",
    description: "Limit admin role assignments",
    enforce: false,
    severity: "low",
    predicate: async (ctx: PolicyContext): Promise<PolicyDecision> => {
      if (ctx.action !== "member.role.updated") return { allowed: true };
      const payload = (ctx.payload ?? {}) as Record<string, unknown>;
      const newRole = typeof payload.roleSlug === "string" ? payload.roleSlug : null;
      if (newRole !== "admin") return { allowed: true };
      const adminCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .innerJoin(roles, eq(roles.id, organizationMembers.roleId))
        .where(
          and(
            eq(organizationMembers.organizationId, ctx.organizationId),
            sql`${roles.slug} = 'admin'`,
          ),
        );
      if (Number(adminCount[0]?.count ?? 0) >= 5) {
        return { allowed: false, reason: "Max 5 admins per organization", metadata: { current: Number(adminCount[0]?.count ?? 0) } };
      }
      return { allowed: true };
    },
  },
  {
    key: "script.max_hours_untouched",
    description: "Flag scripts untouched for 7 days",
    enforce: false,
    severity: "low",
    predicate: async (ctx: PolicyContext): Promise<PolicyDecision> => {
      if (ctx.action !== "script.publish.attempted") return { allowed: true };
      return { allowed: true, metadata: { reviewRecommended: true } };
    },
  },
];

export async function evaluatePolicies(ctx: PolicyContext): Promise<PolicyDecision> {
  let lastDecision: PolicyDecision = { allowed: true };
  for (const rule of BUILTIN_POLICIES) {
    if (!rule.enforce && ctx.action === "policy.evaluate") continue;
    try {
      const decision = await rule.predicate(ctx);
      lastDecision = decision;
      if (!decision.allowed) {
        await recordSecurityEvent({
          organizationId: ctx.organizationId,
          severity: rule.severity,
          kind: `policy.denied`,
          message: `Policy ${rule.key} denied ${ctx.action}`,
          actorUserId: ctx.userId,
          resourceType: ctx.resourceType,
          resourceId: ctx.resourceId,
          payload: { rule: rule.key, reason: decision.reason, metadata: decision.metadata },
        });
        return decision;
      }
      if (decision.metadata) {
        await recordSecurityEvent({
          organizationId: ctx.organizationId,
          severity: rule.severity,
          kind: `policy.warn`,
          message: `Policy ${rule.key} flagged ${ctx.action}`,
          actorUserId: ctx.userId,
          resourceType: ctx.resourceType,
          resourceId: ctx.resourceId,
          payload: { rule: rule.key, metadata: decision.metadata },
        });
      }
    } catch (err) {
      await recordSecurityEvent({
        organizationId: ctx.organizationId,
        severity: "medium",
        kind: "policy.error",
        message: `Policy ${rule.key} errored: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return lastDecision;
}

export async function getOrgPolicy(organizationId: string) {
  const [row] = await db.select().from(governancePolicies).where(eq(governancePolicies.organizationId, organizationId)).limit(1);
  if (!row) {
    return {
      id: null,
      rules: { ...DEFAULT_GOVERNANCE_RULES },
      updatedAt: null,
    };
  }
  return {
    id: row.id,
    rules: { ...DEFAULT_GOVERNANCE_RULES, ...JSON.parse(row.rules) },
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertOrgPolicy(organizationId: string, userId: string, rules: Record<string, boolean>) {
  const [existing] = await db.select().from(governancePolicies).where(eq(governancePolicies.organizationId, organizationId)).limit(1);
  const merged = { ...DEFAULT_GOVERNANCE_RULES, ...rules };

  if (existing) {
    await db
      .update(governancePolicies)
      .set({ rules: JSON.stringify(merged), updatedBy: userId, updatedAt: new Date() })
      .where(eq(governancePolicies.id, existing.id));
    return existing.id;
  }

  const id = randomUUID();
  await db.insert(governancePolicies).values({
    id,
    organizationId,
    rules: JSON.stringify(merged),
    requireHumanReview: true,
    pauseUnsupportedClaims: true,
    updatedBy: userId,
  });
  return id;
}
