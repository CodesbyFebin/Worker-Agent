import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { agentEvents, agentTasks } from "../../drizzle/schema";

export interface AgentEvent {
  taskId: string;
  organizationId?: string | null;
  eventType:
    | "status_changed"
    | "retry"
    | "error"
    | "info"
    | "pipeline_handoff"
    | "pipeline_advance";
  message: string;
}

export type ScopedAgentEvent = AgentEvent & { organizationId: string | null };

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

/** Persists the event to `agent_events` and notifies any live subscribers. */
export async function publishEvent(event: AgentEvent): Promise<void> {
  let organizationId = event.organizationId ?? null;
  if (!organizationId) {
    const [task] = await db
      .select({ organizationId: agentTasks.organizationId })
      .from(agentTasks)
      .where(eq(agentTasks.id, event.taskId))
      .limit(1);
    organizationId = task?.organizationId ?? null;
  }

  await db.insert(agentEvents).values({
    id: randomUUID(),
    organizationId,
    taskId: event.taskId,
    eventType: event.eventType,
    message: event.message,
    createdAt: new Date(),
  });

  const scoped: ScopedAgentEvent = { ...event, organizationId };
  emitter.emit("event", scoped);
}

/**
 * Subscribe to live events. Pass organizationId to receive only that tenant's
 * events; omit to receive none (callers must scope explicitly).
 */
export function subscribeToEvents(
  handler: (event: ScopedAgentEvent) => void,
  organizationId?: string | null,
): () => void {
  const wrapped = (event: ScopedAgentEvent) => {
    if (!organizationId) return;
    if (event.organizationId !== organizationId) return;
    handler(event);
  };
  emitter.on("event", wrapped);
  return () => emitter.off("event", wrapped);
}
