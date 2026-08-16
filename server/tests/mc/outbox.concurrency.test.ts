import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../_core/db";
import {
  claimOutboxBatch,
  reclaimStuckClaims,
} from "../../services/mission-control/outbox";

const integrationEnabled = process.env.MC_INTEGRATION_TESTS === "1";
const suite = integrationEnabled ? describe : describe.skip;
const organizationId = randomUUID();

async function seedOutbox(count: number) {
  for (let i = 0; i < count; i += 1) {
    await pool.query(
      `INSERT INTO mission_control_event_outbox
        (event_id, organization_id, aggregate_type, aggregate_id,
         aggregate_version, event_type, trace_id, payload)
       VALUES (?, ?, 'task', ?, 1, 'task.updated', ?, '{}')`,
      [`evt_${randomUUID()}`, organizationId, `task_${i}`, `trace_${i}`],
    );
  }
}

suite("Mission Control outbox horizontal safety", () => {
  beforeAll(async () => {
    await pool.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES (?, 'MC outbox test', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [organizationId, `mc-outbox-${organizationId}`],
    );
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM mission_control_event_outbox WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM mission_control_event_log WHERE organization_id = ?", [organizationId]);
  });

  afterAll(async () => {
    if (!integrationEnabled) return;
    await pool.query("DELETE FROM mission_control_event_outbox WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM mission_control_event_log WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM organizations WHERE id = ?", [organizationId]);
  });

  it("two concurrent claim batches are disjoint", async () => {
    await seedOutbox(20);
    const [a, b] = await Promise.all([
      claimOutboxBatch("wrk_a", 10),
      claimOutboxBatch("wrk_b", 10),
    ]);
    const aIds = new Set(a.map((row) => row.eventId));
    expect(b.every((row) => !aIds.has(row.eventId))).toBe(true);
    expect(a.length + b.length).toBe(20);
  });

  it("reclaims claims left processing by a dead worker", async () => {
    await seedOutbox(1);
    const [row] = await claimOutboxBatch("wrk_dead", 1);
    expect(row).toBeTruthy();
    await pool.query(
      `UPDATE mission_control_event_outbox
          SET claimed_at = DATE_SUB(NOW(), INTERVAL 120 SECOND)
        WHERE event_id = ?`,
      [row!.eventId],
    );

    expect(await reclaimStuckClaims(60_000)).toBeGreaterThanOrEqual(1);
    const [rows] = await pool.query(
      "SELECT status, claimed_by FROM mission_control_event_outbox WHERE event_id = ?",
      [row!.eventId],
    );
    expect((rows as any[])[0]?.status).toBe("pending");
    expect((rows as any[])[0]?.claimed_by).toBeNull();
  });

  it("enforces durable event id uniqueness", async () => {
    const eventId = `evt_${randomUUID()}`;
    const params = [eventId, organizationId, "task_1", "trace_1"];
    await pool.query(
      `INSERT INTO mission_control_event_log
        (event_id, organization_id, aggregate_type, aggregate_id,
         aggregate_version, event_type, trace_id, payload)
       VALUES (?, ?, 'task', ?, 1, 'task.updated', ?, '{}')`,
      params,
    );
    await expect(
      pool.query(
        `INSERT INTO mission_control_event_log
          (event_id, organization_id, aggregate_type, aggregate_id,
           aggregate_version, event_type, trace_id, payload)
         VALUES (?, ?, 'task', ?, 1, 'task.updated', ?, '{}')`,
        params,
      ),
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
});
