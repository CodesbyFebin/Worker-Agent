import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../_core/db";
import { deadLetterJobs } from "../../../drizzle/schema";
import {
  campaignDayQueue,
  enqueue,
  godMachineChainQueue,
  QUEUE_NAMES,
  scheduledPublishQueue,
  workflowStepQueue,
} from "../../_core/queue";
import { safeJsonStringify, redactString } from "../../_core/redact";
import { incCounter } from "../../_core/metrics";
import type { Queue } from "bullmq";

const QUEUE_BY_NAME: Record<string, Queue> = {
  [QUEUE_NAMES.GOD_MACHINE_CHAIN]: godMachineChainQueue,
  [QUEUE_NAMES.CAMPAIGN_DAY]: campaignDayQueue,
  [QUEUE_NAMES.SCHEDULED_PUBLISH]: scheduledPublishQueue,
  [QUEUE_NAMES.WORKFLOW_STEP]: workflowStepQueue,
};

function extractOrgId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "organizationId" in payload) {
    const v = (payload as { organizationId?: unknown }).organizationId;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export async function recordDeadLetter(params: {
  queueName: string;
  jobName?: string | null;
  bullmqJobId?: string | null;
  payload: unknown;
  errorMessage: string;
  attemptsMade: number;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(deadLetterJobs).values({
    id,
    organizationId: extractOrgId(params.payload),
    queueName: params.queueName,
    jobName: params.jobName ?? null,
    bullmqJobId: params.bullmqJobId ?? null,
    payload: safeJsonStringify(params.payload),
    errorMessage: redactString(params.errorMessage).slice(0, 8_000),
    attemptsMade: params.attemptsMade,
    status: "open",
    createdAt: new Date(),
  });
  incCounter("dlq_enqueued_total");
  return id;
}

export async function listDeadLetters(params: {
  organizationId: string;
  status?: "open" | "retried" | "discarded";
  limit?: number;
}) {
  const limit = Math.min(params.limit ?? 50, 100);
  const conditions = [
    // Org-scoped rows OR system jobs with null org (visible to recoverers in this org)
    sql`(${deadLetterJobs.organizationId} = ${params.organizationId} OR ${deadLetterJobs.organizationId} IS NULL)`,
  ];
  if (params.status) {
    conditions.push(eq(deadLetterJobs.status, params.status));
  }
  return db
    .select({
      id: deadLetterJobs.id,
      organizationId: deadLetterJobs.organizationId,
      queueName: deadLetterJobs.queueName,
      jobName: deadLetterJobs.jobName,
      bullmqJobId: deadLetterJobs.bullmqJobId,
      payload: deadLetterJobs.payload,
      errorMessage: deadLetterJobs.errorMessage,
      attemptsMade: deadLetterJobs.attemptsMade,
      status: deadLetterJobs.status,
      resolvedBy: deadLetterJobs.resolvedBy,
      resolvedAt: deadLetterJobs.resolvedAt,
      createdAt: deadLetterJobs.createdAt,
    })
    .from(deadLetterJobs)
    .where(and(...conditions))
    .orderBy(desc(deadLetterJobs.createdAt))
    .limit(limit);
}

export async function retryDeadLetter(params: {
  organizationId: string;
  userId: string;
  deadLetterId: string;
}): Promise<{ jobId: string }> {
  const [row] = await db
    .select()
    .from(deadLetterJobs)
    .where(eq(deadLetterJobs.id, params.deadLetterId))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dead-letter job not found" });
  if (row.organizationId && row.organizationId !== params.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dead-letter belongs to another organization" });
  }
  if (row.status !== "open") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot retry job in status ${row.status}` });
  }

  const queue = QUEUE_BY_NAME[row.queueName];
  if (!queue) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown queue: ${row.queueName}` });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stored payload is not valid JSON" });
  }

  const job = await enqueue(queue, row.jobName ?? "dlq-retry", payload);
  await db
    .update(deadLetterJobs)
    .set({
      status: "retried",
      resolvedBy: params.userId,
      resolvedAt: new Date(),
    })
    .where(eq(deadLetterJobs.id, row.id));
  incCounter("dlq_retried_total");
  return { jobId: String(job.id) };
}

export async function discardDeadLetter(params: {
  organizationId: string;
  userId: string;
  deadLetterId: string;
}): Promise<{ ok: true }> {
  const [row] = await db
    .select()
    .from(deadLetterJobs)
    .where(eq(deadLetterJobs.id, params.deadLetterId))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dead-letter job not found" });
  if (row.organizationId && row.organizationId !== params.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dead-letter belongs to another organization" });
  }
  if (row.status !== "open") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot discard job in status ${row.status}` });
  }
  await db
    .update(deadLetterJobs)
    .set({
      status: "discarded",
      resolvedBy: params.userId,
      resolvedAt: new Date(),
    })
    .where(eq(deadLetterJobs.id, row.id));
  return { ok: true };
}

export async function deadLetterCounts(organizationId: string) {
  const rows = await db
    .select({
      status: deadLetterJobs.status,
      count: sql<number>`count(*)`,
    })
    .from(deadLetterJobs)
    .where(
      sql`(${deadLetterJobs.organizationId} = ${organizationId} OR ${deadLetterJobs.organizationId} IS NULL)`,
    )
    .groupBy(deadLetterJobs.status);
  const out = { open: 0, retried: 0, discarded: 0 };
  for (const r of rows) {
    const n = Number(r.count);
    if (r.status === "open") out.open = n;
    if (r.status === "retried") out.retried = n;
    if (r.status === "discarded") out.discarded = n;
  }
  return out;
}

export async function queueDepthSnapshot() {
  const names = Object.keys(QUEUE_BY_NAME);
  const depths: Record<string, Awaited<ReturnType<Queue["getJobCounts"]>>> = {};
  for (const name of names) {
    const q = QUEUE_BY_NAME[name]!;
    depths[name] = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  }
  return depths;
}
