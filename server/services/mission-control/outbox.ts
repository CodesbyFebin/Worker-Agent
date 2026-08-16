import { randomUUID } from "crypto";
import { pool } from "../../_core/db";
import { logger } from "../../_core/logger";

const WORKER_ID = `outbox_${randomUUID()}`;
let shutdownRequested = false;

export interface OutboxEnvelope {
  eventId: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  traceId: string;
  payload: unknown;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimBatch(limit = 100): Promise<any[]> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT event_id, organization_id, aggregate_type, aggregate_id,
              aggregate_version, event_type, trace_id, payload, created_at,
              attempt_count
         FROM mission_control_event_outbox
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT ?
        FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    const events = rows as any[];
    if (events.length > 0) {
      const ids = events.map(() => "?").join(",");
      await connection.query(
        `UPDATE mission_control_event_outbox
            SET status = 'processing', claimed_by = ?, claimed_at = NOW(),
                attempt_count = attempt_count + 1
          WHERE event_id IN (${ids})`,
        [WORKER_ID, ...events.map((row) => row.event_id)],
      );
    }
    await connection.commit();
    return events;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function appendToEventLog(row: any): Promise<void> {
  await pool.query(
    `INSERT INTO mission_control_event_log
      (event_id, organization_id, aggregate_type, aggregate_id,
       aggregate_version, event_type, trace_id, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE event_id = VALUES(event_id)`,
    [
      row.event_id,
      row.organization_id,
      row.aggregate_type,
      row.aggregate_id,
      row.aggregate_version,
      row.event_type,
      row.trace_id,
      row.payload,
    ],
  );
}

async function publishOne(row: any): Promise<void> {
  try {
    await appendToEventLog(row);
    await pool.query(
      `UPDATE mission_control_event_outbox
          SET status = 'processed', processed_at = NOW(), last_error = NULL
        WHERE event_id = ? AND claimed_by = ?`,
      [row.event_id, WORKER_ID],
    );
  } catch (error) {
    await pool.query(
      `UPDATE mission_control_event_outbox
          SET status = 'pending', claimed_by = NULL, claimed_at = NULL,
              last_error = ?
        WHERE event_id = ? AND claimed_by = ?`,
      [String(error), row.event_id, WORKER_ID],
    );
    throw error;
  }
}

async function reclaimStuck(maxAgeMs = 60_000): Promise<void> {
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeMs / 1000));
  await pool.query(
    `UPDATE mission_control_event_outbox
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL
      WHERE status = 'processing'
        AND claimed_at < (NOW() - INTERVAL ? SECOND)`,
    [maxAgeSeconds],
  );
}

export async function runOutboxWorker(): Promise<void> {
  while (!shutdownRequested) {
    try {
      await reclaimStuck();
      const batch = await claimBatch();
      for (const row of batch) {
        try {
          await publishOne(row);
        } catch (error) {
          logger.error({ err: error, eventId: row.event_id }, "mission control outbox publish failed");
        }
      }
    } catch (error) {
      logger.error({ err: error }, "mission control outbox cycle failed");
    }
    await sleep(1000);
  }
}

export function stopOutboxWorker(): void {
  shutdownRequested = true;
}
