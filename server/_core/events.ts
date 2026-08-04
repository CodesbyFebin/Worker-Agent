import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { db } from "./db";
import { agentEvents } from "../../drizzle/schema";

export interface AgentEvent {
  taskId: string;
  eventType: "status_changed" | "retry" | "error" | "info";
  message: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

/** Persists the event to `agent_events` and notifies any live subscribers. */
export async function publishEvent(event: AgentEvent): Promise<void> {
  await db.insert(agentEvents).values({
    id: randomUUID(),
    taskId: event.taskId,
    eventType: event.eventType,
    message: event.message,
    createdAt: new Date(),
  });
  emitter.emit("event", event);
}

/** Subscribe to live events (e.g. from an SSE route). Returns an unsubscribe function. */
export function subscribeToEvents(handler: (event: AgentEvent) => void): () => void {
  emitter.on("event", handler);
  return () => emitter.off("event", handler);
}
