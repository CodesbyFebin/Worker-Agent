import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../_core/db";
import { resolveMissionControlApproval } from "../../services/mission-control/approvals";

const integrationEnabled = process.env.MC_INTEGRATION_TESTS === "1";
const suite = integrationEnabled ? describe : describe.skip;
const orgA = randomUUID();
const orgB = randomUUID();
const taskB = randomUUID();
const approvalB = randomUUID();

suite("Mission Control tenant isolation", () => {
  beforeAll(async () => {
    await pool.query("INSERT INTO organizations (id, name, slug) VALUES (?, 'MC tenant A', ?), (?, 'MC tenant B', ?)", [
      orgA,
      `mc-tenant-a-${orgA}`,
      orgB,
      `mc-tenant-b-${orgB}`,
    ]);
    await pool.query(
      `INSERT INTO agent_tasks
        (id, organization_id, run_id, agent_role, title, payload, status)
       VALUES (?, ?, ?, 'publisher', 'Tenant B task', '{}', 'awaiting_approval')`,
      [taskB, orgB, randomUUID()],
    );
    await pool.query(
      `INSERT INTO mission_control_approvals
        (id, approval_gate_key, organization_id, task_id, run_id, type, status,
         requested_by, policy_version, policy_rule_id, evaluation_revision,
         subject_digest, reasons)
       VALUES (?, ?, ?, ?, ?, 'publication', 'pending', ?, '1.0.0',
               'publication_review', ?, ?, '[]')`,
      [approvalB, randomUUID().replaceAll("-", ""), orgB, taskB, randomUUID(), randomUUID(), "r1", "d1"],
    );
  });

  afterAll(async () => {
    if (!integrationEnabled) return;
    await pool.query("DELETE FROM mission_control_approvals WHERE id = ?", [approvalB]);
    await pool.query("DELETE FROM agent_tasks WHERE id = ?", [taskB]);
    await pool.query("DELETE FROM organizations WHERE id IN (?, ?)", [orgA, orgB]);
  });

  it("organization A cannot resolve organization B approval", async () => {
    await expect(
      resolveMissionControlApproval({
        approvalId: approvalB,
        decision: "approved",
        resolvedBy: randomUUID(),
        organizationId: orgA,
        currentClaims: [],
        currentArtifacts: [],
        projectedAction: "publish",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
