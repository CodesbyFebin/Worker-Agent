import { createHash } from "crypto";

export interface GovernanceClaimSnapshot {
  id: string;
  status: string;
}

export interface GovernanceArtifactSnapshot {
  id: string;
  contentHash: string | null;
  estimatedCostUsd?: number | null;
}

export interface GovernanceTaskSnapshot {
  id: string;
  runId?: string | null;
  title: string;
  assignedRole: string;
}

export interface ApprovalSnapshot {
  approvalGateKey: string;
  status: "pending" | "approved" | "rejected" | "expired" | "superseded";
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export function computeEvaluationRevision(params: {
  claims: GovernanceClaimSnapshot[];
  artifacts: GovernanceArtifactSnapshot[];
  policyVersion: string;
}): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        claimStates: params.claims
          .map((claim) => ({ id: claim.id, status: claim.status }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        artifactHashes: params.artifacts
          .map((artifact) => ({ id: artifact.id, hash: artifact.contentHash }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        policyVersion: params.policyVersion,
      }),
    )
    .digest("hex");
}

export function computeSubjectDigest(params: {
  task: GovernanceTaskSnapshot;
  claims: GovernanceClaimSnapshot[];
  artifacts: GovernanceArtifactSnapshot[];
  policyVersion: string;
  projectedAction: string;
}): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        taskInput: {
          id: params.task.id,
          title: params.task.title,
          assignedRole: params.task.assignedRole,
        },
        claimIds: params.claims.map((claim) => claim.id).sort(),
        artifactCosts: params.artifacts
          .map((artifact) => ({ id: artifact.id, cost: artifact.estimatedCostUsd ?? null }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        policyVersion: params.policyVersion,
        projectedAction: params.projectedAction,
      }),
    )
    .digest("hex");
}

export function computeApprovalGateKey(params: {
  runId: string;
  taskId: string;
  policyVersion: string;
  policyRuleId: string;
  evaluationRevision: string;
  subjectDigest: string;
}): string {
  return createHash("sha256")
    .update(
      [
        params.runId,
        params.taskId,
        params.policyVersion,
        params.policyRuleId,
        params.evaluationRevision,
        params.subjectDigest,
      ].join(":"),
    )
    .digest("hex");
}

export function isGateSatisfied(params: {
  approvals: ApprovalSnapshot[];
  currentGateKey: string;
}): boolean {
  return params.approvals.some(
    (approval) => approval.status === "approved" && approval.approvalGateKey === params.currentGateKey,
  );
}
