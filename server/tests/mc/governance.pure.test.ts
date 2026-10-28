import { describe, expect, it } from "vitest";
import {
  computeApprovalGateKey,
  computeEvaluationRevision,
  computeSubjectDigest,
  isGateSatisfied,
} from "../../services/mission-control/governance";

const task = {
  id: "tsk_1",
  runId: "run_1",
  title: "Publish reviewed artifact",
  assignedRole: "publisher",
};
const claims = [{ id: "clm_1", status: "verified" }];
const artifact = (contentHash: string) => ({
  id: "art_1",
  contentHash,
  estimatedCostUsd: 0.25,
});
const base = {
  runId: "run_1",
  taskId: "tsk_1",
  policyVersion: "1.0.0",
  policyRuleId: "publication_review",
};

describe("Mission Control governance gate identity", () => {
  it("is deterministic and uses full SHA-256 digests", () => {
    const input = {
      task,
      claims,
      artifacts: [artifact("hash-a")],
      policyVersion: "1.0.0",
      projectedAction: "publish",
    };
    const a = computeSubjectDigest(input);
    const b = computeSubjectDigest(input);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes evaluation revision when reviewed artifact content changes", () => {
    const a = computeEvaluationRevision({
      claims,
      artifacts: [artifact("hash-a")],
      policyVersion: "1.0.0",
    });
    const b = computeEvaluationRevision({
      claims,
      artifacts: [artifact("hash-b")],
      policyVersion: "1.0.0",
    });
    expect(a).not.toBe(b);
  });

  it("changes subject digest when run identity changes", () => {
    const a = computeSubjectDigest({
      task,
      claims,
      artifacts: [artifact("hash-a")],
      policyVersion: "1.0.0",
      projectedAction: "publish",
    });
    const b = computeSubjectDigest({
      task: { ...task, runId: "run_2" },
      claims,
      artifacts: [artifact("hash-a")],
      policyVersion: "1.0.0",
      projectedAction: "publish",
    });
    expect(a).not.toBe(b);
  });

  it("never lets an approved stale gate satisfy the current gate", () => {
    const oldKey = computeApprovalGateKey({
      ...base,
      evaluationRevision: "r1",
      subjectDigest: "d1",
    });
    const currentKey = computeApprovalGateKey({
      ...base,
      evaluationRevision: "r2",
      subjectDigest: "d2",
    });
    const approvals = [{ approvalGateKey: oldKey, status: "approved" as const }];

    expect(isGateSatisfied({ approvals, currentGateKey: oldKey })).toBe(true);
    expect(isGateSatisfied({ approvals, currentGateKey: currentKey })).toBe(false);
  });
});
