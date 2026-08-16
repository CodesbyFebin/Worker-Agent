import type { Request, Response } from "express";
import IORedis from "ioredis";
import { pool } from "../../_core/db";
import { env } from "../../_core/env";
import { logger } from "../../_core/logger";

export interface StreamEvent {
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

function parseCursor(req: Request): number | null {
  const raw =
    (req.headers["last-event-id"] as string | undefined) ??
    (typeof req.query.after === "string" ? req.query.after : undefined);
  const cursor = Number(raw ?? 0);
  if (!Number.isSafeInteger(cursor) || cursor < 0) return null;
  return cursor;
}

function parseLiveEnvelope(message: string, organizationId: string): StreamEvent | null {
  try {
    const value = JSON.parse(message) as Partial<StreamEvent>;
    if (
      !Number.isSafeInteger(value.streamPosition) ||
      (value.streamPosition ?? 0) <= 0 ||
      typeof value.eventId !== "string" ||
      value.organizationId !== organizationId ||
      typeof value.aggregateType !== "string" ||
      typeof value.aggregateId !== "string" ||
      typeof value.aggregateVersion !== "number" ||
      typeof value.type !== "string" ||
      typeof value.traceId !== "string"
    ) {
      return null;
    }
    return value as StreamEvent;
  } catch {
    return null;
  }
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
  if (through <= after) return [];
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
    payload: (() => {
      try {
        return JSON.parse(row.payload);
      } catch {
        return row.payload;
      }
    })(),
  }));
}

/**
 * Durable SSE handoff. Authentication and tenant membership are resolved by
 * server/_core/index.ts before this handler receives organizationId.
 */
export async function handleMissionControlEvents(
  req: Request,
  res: Response,
  organizationId: string,
): Promise<void> {
  const cursor = parseCursor(req);
  if (cursor === null) {
    res.status(400).json({ error: "Invalid cursor" });
    return;
  }

  const subscriber = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const pending: StreamEvent[] = [];
  let replaying = true;
  let lastSent = cursor;
  let closed = false;

  const send = (event: StreamEvent) => {
    if (closed || event.streamPosition <= lastSent) return;
    res.write(`id: ${event.streamPosition}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    lastSent = event.streamPosition;
  };

  const onMessage = (_channel: string, message: string) => {
    const event = parseLiveEnvelope(message, organizationId);
    if (!event) {
      logger.warn({ organizationId }, "mission control SSE dropped invalid live envelope");
      return;
    }
    if (replaying) pending.push(event);
    else send(event);
  };

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    subscriber.off("message", onMessage);
    await subscriber.unsubscribe(`mc:events:${organizationId}`).catch(() => {});
    await subscriber.quit().catch(() => {});
  };

  req.on("close", () => void cleanup());

  try {
    subscriber.on("message", onMessage);
    await subscriber.subscribe(`mc:events:${organizationId}`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const highWaterMark = await getCurrentStreamPosition(organizationId);
    const missed = await getEventsRange(organizationId, cursor, highWaterMark);
    for (const event of missed) send(event);

    while (pending.length > 0) {
      const batch = pending.splice(0).sort((a, b) => a.streamPosition - b.streamPosition);
      for (const event of batch) send(event);
    }
    replaying = false;
  } catch (error) {
    logger.error({ err: error, organizationId }, "mission control SSE replay failed");
    await cleanup();
    if (!res.headersSent) res.status(500).end();
    else res.end();
    return;
  }

  const heartbeat = setInterval(() => {
    if (!closed) res.write(": heartbeat\n\n");
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
  });
}
