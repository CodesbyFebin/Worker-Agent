import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../_core/db";
import {
  auditLogs,
  agentTasks,
  agentExecutions,
  approvalRequests,
  workflowRuns,
  youtubeVideos,
} from "../../../drizzle/schema";
import { recordSecurityEvent } from "./engine";

export type RetentionRule = {
  table: string;
  olderThanDays: number;
  /** Minimum records to preserve even if they exceed retention. */
  preserveAtLeast?: number;
};

export const DEFAULT_RETENTION_RULES: RetentionRule[] = [
  { table: "agent_events", olderThanDays: 90 },
  { table: "agent_executions", olderThanDays: 365, preserveAtLeast: 50 },
  { table: "approval_requests", olderThanDays: 365 },
  { table: "audit_logs", olderThanDays: 2555, preserveAtLeast: 1000 },
  { table: "workflow_step_runs", olderThanDays: 365 },
  { table: "youtube_videos", olderThanDays: 1825, preserveAtLeast: 50 },
  { table: "idempotency_records", olderThanDays: 90 },
];

export type RetentionRunResult = {
  table: string;
  deleted: number;
  cutoff: string;
};

export async function enforceRetention(organizationId?: string): Promise<RetentionRunResult[]> {
  const results: RetentionRunResult[] = [];

  for (const rule of DEFAULT_RETENTION_RULES) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rule.olderThanDays);
    cutoff.setHours(0, 0, 0, 0);

    let deleted = 0;

    try {
      switch (rule.table) {
        case "agent_events": {
          const conditions = [lt(sql`${auditLogs.createdAt}`, cutoff)];
          if (organizationId) conditions.push(eq(auditLogs.organizationId, organizationId));
          const result = await db.delete(auditLogs).where(and(...conditions));
          deleted = Number(result[0]?.affectedRows ?? 0);
          break;
        }
        case "agent_executions": {
          const conditions = [lt(sql`${agentExecutions.createdAt}`, cutoff)];
          if (organizationId) conditions.push(eq(agentExecutions.organizationId, organizationId));
          const result = await db.delete(agentExecutions).where(and(...conditions));
          deleted = Number(result[0]?.affectedRows ?? 0);
          break;
        }
        case "approval_requests": {
          const conditions = [lt(sql`${approvalRequests.createdAt}`, cutoff)];
          if (organizationId) conditions.push(eq(approvalRequests.organizationId, organizationId));
          const result = await db.delete(approvalRequests).where(and(...conditions));
          deleted = Number(result[0]?.affectedRows ?? 0);
          break;
        }
        case "audit_logs": {
          const conditions = [lt(sql`${auditLogs.createdAt}`, cutoff)];
          if (organizationId) conditions.push(eq(auditLogs.organizationId, organizationId));
          if (rule.preserveAtLeast) {
            const [oldest] = await db
              .select({ id: auditLogs.id })
              .from(auditLogs)
              .where(and(...conditions))
              .orderBy(auditLogs.createdAt)
              .limit(1);
            if (oldest) {
              const preservedCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(auditLogs)
                .where(and(...conditions, eq(auditLogs.id, oldest.id)));
              if (Number(preservedCount[0]?.count ?? 0) <= rule.preserveAtLeast) break;
            }
          }
          const result = await db.delete(auditLogs).where(and(...conditions));
          deleted = Number(result[0]?.affectedRows ?? 0);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      await recordSecurityEvent({
        organizationId,
        severity: "low",
        kind: "retention.error",
        message: `Retention failed for ${rule.table}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (deleted > 0) {
      await recordSecurityEvent({
        organizationId,
        severity: "info",
        kind: "retention.enforced",
        message: `Purged ${deleted} rows from ${rule.table} older than ${rule.olderThanDays} days`,
        resourceType: rule.table,
        payload: { deleted, cutoff: cutoff.toISOString(), rule },
      });
    }

    results.push({ table: rule.table, deleted, cutoff: cutoff.toISOString() });
  }

  return results;
}
