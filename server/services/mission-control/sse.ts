import type { Express, Request, Response } from "express";
import { pool } from "../../_core/db";
import { logger } from "../../_core/logger";

interface StreamEvent {
  streamPosition: number;
  eventId: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  type: string;
  traceId: string;
  payload: unknown;
}

type Subscriber = (event: StreamEvent) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function publishMissionControlStreamEvent(event: StreamEvent): void {
  const handlers = subscribers.get(event.organizationId);
  if (!handlers) return;
  for (const handler of handlers) handler(event);
}

function subscribe(organizationId: string, handler: Subscriber): () => void {
  let handlers = subscribers.get(organizationId);
  if (!handlers) {
    handlers = new Set();
    subscribers.set(organizationId, handlers);
  }
  handlers.add(handler);
  return () => {
    handlers?.delete(handler);
    if (handlers?.size === 0) subscribers.delete(organizationId);
  };
}

async function getCurrentStreamPosition(organizationId: string): Promise<number> {
  const [rows] = await pool.query(
    `SELECT COALESCE(MAX(stream_position), 0) AS position
       FROM mission_control_event_log
      WHERE organization_id = ?`,
    [organizationId],
  );
  return Number((rows as any[])[0]?.position ?? 0);
}

async function getEventsRange(
  organizationId: string,
  after: number,
  through: number,
): Promise<StreamEvent[]> {
  const [rows] = await pool.query(
    `SELECT stream_position, event_id, organization_id, aggregate_type,
            aggregate_id, aggregate_version, event_type, trace_id, payload
       FROM mission_control_event_log
      WHERE organization_id = ?
        AND stream_position > ?
        AND stream_position <= ?
      ORDER BY stream_position ASC`,
    [organizationId, after, through],
  );
  return (rows as any[]).map((row) => ({
    streamPosition: Number(row.stream_position),
    eventId: row.event_id,
    organizationId: row.organization_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: Number(row.aggregate_version),
    type: row.event_type,
    traceId: row.trace_id,
    payload: JSON.parse(row.payload),
  }));
}

function resolveOrganizationId(req: Request): string | null {
  return (req as any).context?.organizationId ?? (req as any).org?.id ?? null;
}

export function setupMissionControlSSE(app: Express): void {
  app.get("/events", async (req: Request, res: Response) => {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) return res.status(401).end();

    const raw = (req.headers["last-event-id"] as string | undefined) ??
      (typeof req.query.after === "string" ? req.query.after : undefined);
    const cursor = Number(raw ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let replaying = true;
    let lastSent = cursor;
    const pending: StreamEvent[] = [];

    const send = (event: StreamEvent) => {
      if (event.streamPosition <= lastSent) return;
      res.write(`id: ${event.streamPosition}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      lastSent = event.streamPosition;
    };

    const unsubscribe = subscribe(organizationId, (event) => {
      if (replaying) {
        pending.push(event);
        return;
      }
      send(event);
    });

    try {
      const highWaterMark = await getCurrentStreamPosition(organizationId);
      const missed = await getEventsRange(organizationId, cursor, highWaterMark);
      for (const event of missed) send(event);

      while (pending.length > 0) {
        const batch = pending.splice(0).sort((a, b) => a.streamPosition - b.streamPosition);
        for (const event of batch) send(event);
      }
      replaying = false;
    } catch (error) {
      unsubscribe();
      logger.error({ err: error, organizationId }, "mission control SSE replay failed");
      if (!res.headersSent) return res.status(500).end();
      return res.end();
    }

    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
