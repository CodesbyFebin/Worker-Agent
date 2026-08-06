import { randomUUID } from "crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../../_core/db";
import { auditLogs, organizationMembers, users } from "../../../drizzle/schema";
import { writeAuditLog } from "../../_core/auth/audit";
import { recordSecurityEvent } from "./engine";

export type DataSubjectRequest = {
  id: string;
  organizationId: string;
  subjectUserId: string;
  type: "access" | "erasure" | "rectification" | "portability";
  status: "received" | "processing" | "completed" | "rejected" | "expired";
  reason?: string;
  requestedBy: string;
  processedBy?: string;
  resultPayload?: string;
  expiresAt: Date;
  createdAt: Date;
};

const GDPR_RETENTION_DAYS = 30;
const MAX_REPORT_BYTES = 1_000_000;

export async function requestDataSubjectAccess(params: {
  organizationId: string;
  subjectUserId: string;
  requestedBy: string;
  reason?: string;
}): Promise<DataSubjectRequest> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GDPR_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(auditLogs).values({
    id: randomUUID(),
    organizationId: params.organizationId,
    actorUserId: params.requestedBy,
    action: "gdpr.dsar.requested",
    resourceType: "data_subject",
    resourceId: params.subjectUserId,
    payload: { dsarId: id, reason: params.reason },
    createdAt: now,
  });

  const row = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, id))
    .limit(1);

  return {
    id,
    organizationId: params.organizationId,
    subjectUserId: params.subjectUserId,
    type: "access",
    status: "received",
    reason: params.reason,
    requestedBy: params.requestedBy,
    expiresAt,
    createdAt: now,
  };
}

export async function requestDataErasure(params: {
  organizationId: string;
  subjectUserId: string;
  requestedBy: string;
  reason?: string;
  redactOnly?: boolean;
}): Promise<DataSubjectRequest> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GDPR_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  if (params.redactOnly) {
    await redactUserData(params.subjectUserId, params.requestedBy);
  } else {
    await anonymizeUserData(params.subjectUserId, params.requestedBy);
  }

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.requestedBy,
    action: "gdpr.erasure.requested",
    resourceType: "user",
    resourceId: params.subjectUserId,
    payload: { dsarId: id, redactOnly: params.redactOnly ?? false },
  });

  return {
    id,
    organizationId: params.organizationId,
    subjectUserId: params.subjectUserId,
    type: "erasure",
    status: "completed",
    reason: params.reason,
    requestedBy: params.requestedBy,
    processedBy: params.requestedBy,
    expiresAt,
    createdAt: now,
  };
}

async function redactUserData(userId: string, actorUserId: string) {
  await db
    .update(users)
    .set({
      email: `redacted-${userId}@redacted.invalid`,
      displayName: "Redacted User",
    })
    .where(eq(users.id, userId));

  await db
    .update(organizationMembers)
    .set({ revokedAt: new Date() })
    .where(eq(organizationMembers.userId, userId));

  await writeAuditLog({
    actorUserId,
    action: "gdpr.erasure.redacted",
    resourceType: "user",
    resourceId: userId,
    payload: { mode: "redact" },
  });
}

async function anonymizeUserData(userId: string, actorUserId: string) {
  const anonId = `anon-${randomUUID().slice(0, 8)}`;
  await db
    .update(users)
    .set({
      email: `${anonId}@anonymized.invalid`,
      displayName: "Anonymized User",
    })
    .where(eq(users.id, userId));

  await db
    .update(organizationMembers)
    .set({ revokedAt: new Date() })
    .where(eq(organizationMembers.userId, userId));

  await writeAuditLog({
    actorUserId,
    action: "gdpr.erasure.anonymized",
    resourceType: "user",
    resourceId: userId,
    payload: { mode: "anonymize", anonId },
  });
}

export async function generateDataPortabilityReport(params: {
  organizationId: string;
  subjectUserId: string;
  requestedBy: string;
}): Promise<{ id: string; reportJson: string; byteSize: number }> {
  const [user] = await db.select().from(users).where(eq(users.id, params.subjectUserId)).limit(1);
  if (!user) throw new Error("User not found");

  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, params.subjectUserId));

  const orgAudit = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, params.organizationId),
        eq(auditLogs.actorUserId, params.subjectUserId),
        gt(auditLogs.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(500);

  const report = {
    generatedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
    memberships: memberships.map((m) => ({ organizationId: m.organizationId, roleId: m.roleId, createdAt: m.createdAt })),
    auditTrail: orgAudit.map((a) => ({ action: a.action, resourceType: a.resourceType, createdAt: a.createdAt })),
  };

  const json = JSON.stringify(report, null, 2);
  if (json.length > MAX_REPORT_BYTES) {
    throw new Error(`Portability report exceeds ${MAX_REPORT_BYTES} bytes`);
  }

  const id = randomUUID();
  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.requestedBy,
    action: "gdpr.portability.exported",
    resourceType: "user",
    resourceId: params.subjectUserId,
    payload: { reportId: id, byteSize: json.length },
  });

  return { id, reportJson: json, byteSize: json.length };
}

export async function expireOldDataSubjectRequests() {
  const expired = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "gdpr.dsar.requested"),
        lt(sql`${auditLogs.createdAt}`, new Date(Date.now() - (GDPR_RETENTION_DAYS + 7) * 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(50);

  for (const row of expired) {
    await recordSecurityEvent({
      organizationId: row.organizationId ?? undefined,
      severity: "low",
      kind: "gdpr.dsar.expired",
      message: `GDPR request expired for user ${row.resourceId}`,
      resourceType: "data_subject",
      resourceId: row.resourceId ?? undefined,
    });
  }

  return expired.length;
}
