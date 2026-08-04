import { randomUUID } from "crypto";
import { db } from "../db";
import { auditLogs } from "../../../drizzle/schema";
import { safeJsonStringify } from "../redact";

export async function writeAuditLog(params: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
}): Promise<void> {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    organizationId: params.organizationId ?? null,
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    payload: params.payload == null ? null : safeJsonStringify(params.payload),
    createdAt: new Date(),
  });
}
