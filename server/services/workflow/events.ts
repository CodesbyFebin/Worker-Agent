import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { workflowRunEvents } from "../../../drizzle/schema";

export async function emitWorkflowEvent(params: {
  organizationId: string;
  workflowRunId: string;
  stepRunId?: string | null;
  type: string;
  message: string;
  payload?: unknown;
}): Promise<void> {
  await db.insert(workflowRunEvents).values({
    id: randomUUID(),
    organizationId: params.organizationId,
    workflowRunId: params.workflowRunId,
    stepRunId: params.stepRunId ?? null,
    type: params.type,
    message: params.message,
    payload: params.payload == null ? null : JSON.stringify(params.payload),
    createdAt: new Date(),
  });
}

export async function listWorkflowEvents(runId: string, organizationId: string, limit = 100) {
  const { desc, and } = await import("drizzle-orm");
  return db
    .select()
    .from(workflowRunEvents)
    .where(and(eq(workflowRunEvents.workflowRunId, runId), eq(workflowRunEvents.organizationId, organizationId)))
    .orderBy(desc(workflowRunEvents.createdAt))
    .limit(limit);
}
