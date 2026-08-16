import { randomBytes } from "node:crypto";
import IORedis from "ioredis";
import { db, pool } from "../../_core/db";
import { env } from "../../_core/env";
import { logger } from "../../_core/logger";
import { missionControlEventOutbox as outbox } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface McEventInput {
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  traceId: string;
  payload: unknown;
}

export interface ClaimedOutboxRow {
  eventId: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  traceId: string;
  payload: string;
  createdAt: Date;
  attemptCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Insert into the outbox inside the caller's transaction. */
export async function appendDurableEvent(tx: Tx, event: McEventInput): Promise<string> {
  const eventId = `evt_${randomBytes(16).toString("hex")}`;
  await tx.insert(outbox).values({
    eventId,
    organizationId: event.organizationId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    aggregateVersion: event.aggregateVersion,
    eventType: event.eventType,
    traceId: event.traceId,
    payload: JSON.stringify(event.payload),
  });
  return eventId;
}

/** Horizontal-safe MySQL claim using FOR UPDATE SKIP LOCKED. */
export async function claimOutboxBatch(workerId: string, limit = 100): Promise<ClaimedOutboxRow[]> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT event_id, organization_id, aggregate_type, aggregate_id,
              aggregate_version, event_type, trace_id, payload, created_at,
              attempt_count
         FROM mission_control_event_outbox
        WHERE status = 'pending'
        ORDER BY created_at, event_id
        LIMIT ?
        FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    const raw = rows as any[];
    if (raw.length > 0) {
      const placeholders = raw.map(() => "?").join(",");
      await connection.query(
        `UPDATE mission_control_event_outbox
            SET status = 'processing', claimed_by = ?, claimed_at = NOW(),
                attempt_count = attempt_count + 1
          WHERE event_id IN (${placeholders})`,
        [workerId, ...raw.map((row) => row.event_id)],
      );
    }
    await connection.commit();
    return raw.map((row) => ({
      eventId: row.event_id,
      organizationId: row.organization_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      aggregateVersion: Number(row.aggregate_version),
      eventType: row.event_type,
      traceId: row.trace_id,
      payload: row.payload,
      createdAt: row.created_at,
      attemptCount: Number(row.attempt_count ?? 0) + 1,
    }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reclaimStuckClaims(maxAgeMs = 60_000): Promise<number> {
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeMs / 1000));
  const [result] = await pool.query(
    `UPDATE mission_control_event_outbox
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL
      WHERE status = 'processing'
        AND claimed_at < (NOW() - INTERVAL ? SECOND)`,
    [maxAgeSeconds],
  );
  return Number((result as any).affectedRows ?? 0);
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

/**
 * Append idempotently to the durable log and mark the outbox row processed in
 * one MySQL transaction. A crash after commit but before Redis publish is
 * recovered by SSE replay from the durable log on reconnect.
 */
async function publishOne(row: ClaimedOutboxRow, publisher: IORedis): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO mission_control_event_log
        (event_id, organization_id, aggregate_type, aggregate_id,
         aggregate_version, event_type, trace_id, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE event_id = VALUES(event_id)`,
      [
        row.eventId,
        row.organizationId,
        row.aggregateType,
        row.aggregateId,
        row.aggregateVersion,
        row.eventType,
        row.traceId,
        row.payload,
      ],
    );
    await connection.query(
      `UPDATE mission_control_event_outbox
          SET status = 'processed', processed_at = NOW(), last_error = NULL
        WHERE event_id = ?`,
      [row.eventId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await pool.query(
      `UPDATE mission_control_event_outbox
          SET status = 'pending', claimed_by = NULL, claimed_at = NULL,
              last_error = ?
        WHERE event_id = ?`,
      [String(error).slice(0, 65535), row.eventId],
    );
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.query(
    `SELECT stream_position
       FROM mission_control_event_log
      WHERE event_id = ?
      LIMIT 1`,
    [row.eventId],
  );
  const streamPosition = Number((rows as any[])[0]?.stream_position ?? 0);
  if (!Number.isSafeInteger(streamPosition) || streamPosition <= 0) {
    throw new Error(`Missing durable stream position for ${row.eventId}`);
  }

  await publisher.publish(
    `mc:events:${row.organizationId}`,
    JSON.stringify({
      streamPosition,
      eventId: row.eventId,
      organizationId: row.organizationId,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      aggregateVersion: row.aggregateVersion,
      type: row.eventType,
      traceId: row.traceId,
      payload: parsePayload(row.payload),
    }),
  );
}

/** Worker lifecycle is owned by server/_core/worker.ts. */
export function startOutboxWorker(workerId = `wrk_${randomBytes(8).toString("hex")}`) {
  let stopped = false;
  const publisher = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const loop = (async () => {
    while (!stopped) {
      try {
        await reclaimStuckClaims();
        const batch = await claimOutboxBatch(workerId);
        for (const row of batch) {
          if (stopped) break;
          try {
            await publishOne(row, publisher);
          } catch (error) {
            logger.error({ err: error, eventId: row.eventId }, "mc outbox publish failed");
          }
        }
      } catch (error) {
        logger.error({ err: error }, "mc outbox cycle failed");
      }
      if (!stopped) await sleep(1000);
    }
  })();

  return {
    workerId,
    async stop(): Promise<void> {
      stopped = true;
      await loop.catch(() => {});
      await publisher.quit().catch(() => {});
    },
  };
}
