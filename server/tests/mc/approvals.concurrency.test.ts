import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../_core/db";
import {
  computeApprovalGateKey,
  computeEvaluationRevision,
  computeSubjectDigest,
  isGateSatisfied,
} from "../../services/mission-control/governance";
import { resolveMissionControlApproval } from "../../services/mission-control/approvals";

const integrationEnabled = process.env.MC_INTEGRATION_TESTS === "1";
const suite = integrationEnabled ? describe : describe.skip;
const organizationId = randomUUID();
const userId = randomUUID();
const workflowId = randomUUID();
const workflowVersionId = randomUUID();

const claims = [{ id: "claim_verified", status: "verified" }];
const artifacts = (hash: string) => [{ id: "artifact_1", contentHash: hash, estimatedCostUsd: 1 }];

async function seedGate(options: { artifactHash?: string; deleteRun?: boolean } = {}) {
  const runId = randomUUID();
  const taskId = randomUUID();
  const approvalId = randomUUID();
  const policyVersion = "1.0.0";
  const policyRuleId = "publication_review";
  const artifactHash = options.artifactHash ?? "hash-a";

  await pool.query(
    `INSERT INTO workflow_runs
      (id, organization_id, workflow_id, workflow_version_id, status, trigger_type, trace_id)
     VALUES (?, ?, ?, ?, 'running', 'manual', ?)`,
    [runId, organizationId, workflowId, workflowVersionId, `trace_${runId}`],
  );
  await pool.query(
    `INSERT INTO agent_tasks
      (id, organization_id, run_id, agent_role, title, payload, status)
     VALUES (?, ?, ?, 'publisher', 'Publish reviewed artifact', '{}', 'awaiting_approval')`,
    [taskId, organizationId, runId],
  );

  const evaluationRevision = computeEvaluationRevision({
    claims,
    artifacts: artifacts(artifactHash),
    policyVersion,
  });
  const subjectDigest = computeSubjectDigest({
    task: { id: taskId, runId, title: "Publish reviewed artifact", assignedRole: "publisher" },
    claims,
    artifacts: artifacts(artifactHash),
    policyVersion,
    projectedAction: "publish",
  });
  const approvalGateKey = computeApprovalGateKey({
    runId,
    taskId,
    policyVersion,
    policyRuleId,
    evaluationRevision,
    subjectDigest,
  });

  await pool.query(
    `INSERT INTO mission_control_approvals
      (id, approval_gate_key, organization_id, task_id, run_id, type, status,
       requested_by, policy_version, policy_rule_id, evaluation_revision,
       subject_digest, reasons)
     VALUES (?, ?, ?, ?, ?, 'publication', 'pending', ?, ?, ?, ?, ?, '["publication review"]')`,
    [
      approvalId,
      approvalGateKey,
      organizationId,
      taskId,
      runId,
      userId,
      policyVersion,
      policyRuleId,
      evaluationRevision,
      subjectDigest,
    ],
  );

  if (options.deleteRun) {
    await pool.query("DELETE FROM workflow_runs WHERE id = ?", [runId]);
  }

  return { approvalId, approvalGateKey, taskId, runId, artifactHash };
}

function resolveInput(
  approvalId: string,
  decision: "approved" | "rejected" = "approved",
  artifactHash = "hash-a",
  org = organizationId,
) {
  return {
    approvalId,
    decision,
    resolvedBy: userId,
    organizationId: org,
    currentClaims: claims,
    currentArtifacts: artifacts(artifactHash),
    projectedAction: "publish",
  };
}

suite("Mission Control approval transaction invariants", () => {
  beforeAll(async () => {
    await pool.query("INSERT INTO users (id, email) VALUES (?, ?)", [userId, `mc-${userId}@example.invalid`]);
    await pool.query("INSERT INTO organizations (id, name, slug) VALUES (?, 'MC approval test', ?)", [
      organizationId,
      `mc-approval-${organizationId}`,
    ]);
    await pool.query(
      `INSERT INTO workflow_definitions
        (id, organization_id, name, status, created_by)
       VALUES (?, ?, 'Mission Control test workflow', 'published', ?)`,
      [workflowId, organizationId, userId],
    );
    await pool.query(
      `INSERT INTO workflow_versions
        (id, workflow_id, organization_id, version, graph, created_by)
       VALUES (?, ?, ?, 1, '{"nodes":[],"edges":[]}', ?)`,
      [workflowVersionId, workflowId, organizationId, userId],
    );
  });

  afterAll(async () => {
    if (!integrationEnabled) return;
    await pool.query("DELETE FROM mission_control_event_outbox WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM mission_control_event_log WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM mission_control_approvals WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM audit_logs WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM agent_tasks WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM workflow_runs WHERE organization_id = ?", [organizationId]);
    await pool.query("DELETE FROM workflow_versions WHERE id = ?", [workflowVersionId]);
    await pool.query("DELETE FROM workflow_definitions WHERE id = ?", [workflowId]);
    await pool.query("DELETE FROM organizations WHERE id = ?", [organizationId]);
    await pool.query("DELETE FROM users WHERE id = ?", [userId]);
  });

  it("allows exactly one winner for concurrent double resolution", async () => {
    const { approvalId } = await seedGate();
    const results = await Promise.allSettled([
      resolveMissionControlApproval(resolveInput(approvalId, "approved")),
      resolveMissionControlApproval(resolveInput(approvalId, "rejected")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason?.code).toBe("CONFLICT");
  });

  it("commits supersession and a fresh pending gate when reviewed state changed", async () => {
    const { approvalId, taskId } = await seedGate({ artifactHash: "hash-a" });
    await expect(
      resolveMissionControlApproval(resolveInput(approvalId, "approved", "hash-b")),
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("APPROVAL_STALE") });

    const [oldRows] = await pool.query("SELECT status FROM mission_control_approvals WHERE id = ?", [approvalId]);
    expect((oldRows as any[])[0]?.status).toBe("superseded");
    const [freshRows] = await pool.query(
      "SELECT id FROM mission_control_approvals WHERE task_id = ? AND status = 'pending'",
      [taskId],
    );
    expect((freshRows as any[]).length).toBe(1);
  });

  it("approved current gate satisfies re-evaluation without an approval loop", async () => {
    const { approvalId, approvalGateKey, taskId } = await seedGate();
    await resolveMissionControlApproval(resolveInput(approvalId, "approved"));
    const [taskRows] = await pool.query("SELECT status FROM agent_tasks WHERE id = ?", [taskId]);
    expect((taskRows as any[])[0]?.status).toBe("ready");
    const [approvalRows] = await pool.query(
      "SELECT approval_gate_key, status FROM mission_control_approvals WHERE id = ?",
      [approvalId],
    );
    const row = (approvalRows as any[])[0];
    expect(
      isGateSatisfied({
        approvals: [{ approvalGateKey: row.approval_gate_key, status: row.status }],
        currentGateKey: approvalGateKey,
      }),
    ).toBe(true);
  });

  it("treats a missing run as an integrity failure", async () => {
    const { approvalId } = await seedGate({ deleteRun: true });
    await expect(resolveMissionControlApproval(resolveInput(approvalId))).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
