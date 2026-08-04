import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../_core/db";
import {
  idempotencyRecords,
  workflowDefinitions,
  workflowRuns,
  workflowStepRuns,
  workflowVersions,
} from "../../../drizzle/schema";
import { enqueue, workflowStepQueue } from "../../_core/queue";
import {
  compileWorkflowGraph,
  hasCompileErrors,
  type CompiledWorkflow,
  type WorkflowGraph,
  type WorkflowNode,
} from "./types";
import { emitWorkflowEvent } from "./events";
import { executeNode, type StepContext } from "./executors";

export type WorkflowStepJobData = {
  organizationId: string;
  workflowRunId: string;
  stepRunId: string;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadCompiled(versionId: string): Promise<CompiledWorkflow> {
  const [version] = await db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.id, versionId))
    .limit(1);
  if (!version) throw new Error("Workflow version not found");
  return compileWorkflowGraph(parseJson(version.graph, { nodes: [], edges: [] }));
}

function nodeById(compiled: CompiledWorkflow, nodeId: string): WorkflowNode | undefined {
  return compiled.graph.nodes.find((n) => n.id === nodeId);
}

/** Parents that must complete (or be skipped) before node may run. */
function requiredParents(compiled: CompiledWorkflow, nodeId: string): string[] {
  return compiled.reverseAdjacency.get(nodeId) ?? [];
}

function shouldFollowEdge(
  edgeLabel: string | undefined,
  sourceOutput: unknown,
): boolean {
  if (!edgeLabel) return true;
  if (sourceOutput && typeof sourceOutput === "object" && "pass" in (sourceOutput as object)) {
    const pass = Boolean((sourceOutput as { pass?: boolean }).pass);
    if (edgeLabel === "true" || edgeLabel === "pass") return pass;
    if (edgeLabel === "false" || edgeLabel === "fail") return !pass;
  }
  return true;
}

export async function startWorkflowRun(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  input?: Record<string, unknown>;
}): Promise<{ runId: string }> {
  const [wf] = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.id, params.workflowId),
        eq(workflowDefinitions.organizationId, params.organizationId),
      ),
    )
    .limit(1);
  if (!wf) throw new Error("Workflow not found");
  if (!wf.currentVersionId) throw new Error("Workflow has no version");
  if (wf.status === "archived") throw new Error("Workflow is archived");

  const compiled = await loadCompiled(wf.currentVersionId);
  if (hasCompileErrors(compiled)) {
    throw new Error(
      `Workflow graph invalid: ${compiled.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`,
    );
  }

  const runId = randomUUID();
  const now = new Date();
  await db.insert(workflowRuns).values({
    id: runId,
    organizationId: params.organizationId,
    workflowId: wf.id,
    workflowVersionId: wf.currentVersionId,
    status: "queued",
    triggerType: "manual",
    input: JSON.stringify(params.input ?? {}),
    output: null,
    errorMessage: null,
    startedBy: params.userId,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const stepRows = compiled.graph.nodes.map((node) => ({
    id: randomUUID(),
    organizationId: params.organizationId,
    workflowRunId: runId,
    nodeId: node.id,
    nodeType: node.type,
    name: node.name,
    status: "pending" as const,
    attempt: 0,
    input: null,
    output: null,
    errorMessage: null,
    decisionSummary: null,
    idempotencyKey: null as string | null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(workflowStepRuns).values(stepRows);

  await emitWorkflowEvent({
    organizationId: params.organizationId,
    workflowRunId: runId,
    type: "run.created",
    message: `Run created for workflow ${wf.name}`,
  });

  // Enqueue trigger nodes only — each step job enqueues eligible children.
  for (const trigger of compiled.triggers) {
    const step = stepRows.find((s) => s.nodeId === trigger.id);
    if (!step) continue;
    await enqueueStep(params.organizationId, runId, step.id, 0);
  }

  await db
    .update(workflowRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(workflowRuns.id, runId));

  await emitWorkflowEvent({
    organizationId: params.organizationId,
    workflowRunId: runId,
    type: "run.started",
    message: "Run started — trigger steps queued",
  });

  return { runId };
}

async function enqueueStep(
  organizationId: string,
  workflowRunId: string,
  stepRunId: string,
  delayMs: number,
): Promise<void> {
  await db
    .update(workflowStepRuns)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(workflowStepRuns.id, stepRunId));

  await enqueue(
    workflowStepQueue,
    "run-step",
    { organizationId, workflowRunId, stepRunId } satisfies WorkflowStepJobData,
    { delayMs },
  );
}

/**
 * Processes exactly one workflow step. Never walks the whole graph in this job.
 */
export async function processWorkflowStep(job: WorkflowStepJobData): Promise<void> {
  const [step] = await db
    .select()
    .from(workflowStepRuns)
    .where(
      and(
        eq(workflowStepRuns.id, job.stepRunId),
        eq(workflowStepRuns.organizationId, job.organizationId),
      ),
    )
    .limit(1);
  if (!step) return;

  // Idempotent: already terminal
  if (["completed", "failed", "cancelled", "skipped", "awaiting_approval"].includes(step.status)) {
    if (step.status === "awaiting_approval") return;
    await maybeEnqueueDownstream(job.organizationId, job.workflowRunId, step.nodeId);
    await maybeFinalizeRun(job.organizationId, job.workflowRunId);
    return;
  }

  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(
      and(eq(workflowRuns.id, job.workflowRunId), eq(workflowRuns.organizationId, job.organizationId)),
    )
    .limit(1);
  if (!run) return;
  if (["cancelled", "failed", "paused", "completed", "completed_with_warnings"].includes(run.status)) {
    return;
  }

  const compiled = await loadCompiled(run.workflowVersionId);
  const node = nodeById(compiled, step.nodeId);
  if (!node) {
    await failStep(step.id, job, "Node missing from graph version");
    return;
  }

  // Dependency check
  const parents = requiredParents(compiled, step.nodeId);
  if (parents.length) {
    const parentSteps = await db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.workflowRunId, job.workflowRunId),
          inArray(workflowStepRuns.nodeId, parents),
        ),
      );

    for (const p of parents) {
      const ps = parentSteps.find((x) => x.nodeId === p);
      if (!ps || !["completed", "skipped"].includes(ps.status)) {
        // Not ready — leave pending (another completion will re-enqueue)
        await db
          .update(workflowStepRuns)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(workflowStepRuns.id, step.id));
        return;
      }
      // Branch filtering for condition edges
      const edge = compiled.graph.edges.find((e) => e.source === p && e.target === step.nodeId);
      const parentOut = parseJson(ps.output, null);
      if (!shouldFollowEdge(edge?.label, parentOut)) {
        await db
          .update(workflowStepRuns)
          .set({
            status: "skipped",
            decisionSummary: `Skipped — branch '${edge?.label ?? ""}' not taken`,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowStepRuns.id, step.id));
        await emitWorkflowEvent({
          organizationId: job.organizationId,
          workflowRunId: job.workflowRunId,
          stepRunId: step.id,
          type: "step.skipped",
          message: `Step ${node.name} skipped (branch)`,
        });
        await maybeEnqueueDownstream(job.organizationId, job.workflowRunId, step.nodeId);
        await maybeFinalizeRun(job.organizationId, job.workflowRunId);
        return;
      }
    }
  }

  const attempt = step.attempt + 1;
  const idempotencyKey = `${node.type}:${job.organizationId}:${job.workflowRunId}:${step.nodeId}:${attempt}`;

  // Delay nodes: schedule a follow-up job once, then execute on the delayed pickup.
  if (node.type === "logic.delay") {
    const delayMs = Math.max(0, Number(node.config.delayMs ?? 0));
    const alreadyScheduled = step.decisionSummary === "delay-scheduled";
    if (delayMs > 0 && !alreadyScheduled) {
      await db
        .update(workflowStepRuns)
        .set({
          status: "waiting",
          decisionSummary: "delay-scheduled",
          attempt,
          updatedAt: new Date(),
        })
        .where(eq(workflowStepRuns.id, step.id));
      await enqueueStep(job.organizationId, job.workflowRunId, step.id, delayMs);
      await emitWorkflowEvent({
        organizationId: job.organizationId,
        workflowRunId: job.workflowRunId,
        stepRunId: step.id,
        type: "step.waiting",
        message: `Delaying ${delayMs}ms`,
      });
      return;
    }
  }

  // Side-effect idempotency lookup
  if (node.type === "output.notify" || node.requiresApproval) {
    const [existing] = await db
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.organizationId, job.organizationId),
          eq(idempotencyRecords.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing?.result) {
      await db
        .update(workflowStepRuns)
        .set({
          status: "completed",
          output: existing.result,
          decisionSummary: "Idempotent replay of prior result",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowStepRuns.id, step.id));
      await maybeEnqueueDownstream(job.organizationId, job.workflowRunId, step.nodeId);
      await maybeFinalizeRun(job.organizationId, job.workflowRunId);
      return;
    }
  }

  await db
    .update(workflowStepRuns)
    .set({
      status: "running",
      attempt,
      idempotencyKey,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowStepRuns.id, step.id));

  await emitWorkflowEvent({
    organizationId: job.organizationId,
    workflowRunId: job.workflowRunId,
    stepRunId: step.id,
    type: "step.started",
    message: `Step ${node.name} started (attempt ${attempt})`,
  });

  const parentOutputs: Record<string, unknown> = {};
  if (parents.length) {
    const parentSteps = await db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.workflowRunId, job.workflowRunId),
          inArray(workflowStepRuns.nodeId, parents),
        ),
      );
    for (const ps of parentSteps) {
      parentOutputs[ps.nodeId] = parseJson(ps.output, null);
    }
  }

  const ctx: StepContext = {
    organizationId: job.organizationId,
    workflowRunId: job.workflowRunId,
    stepRunId: step.id,
    runInput: parseJson(run.input, {}),
    parentOutputs,
    node,
  };

  try {
    const result = await executeNode(ctx);
    const outputJson = JSON.stringify(result.output ?? null);

    if (result.status === "awaiting_approval") {
      await db
        .update(workflowStepRuns)
        .set({
          status: "awaiting_approval",
          output: outputJson,
          decisionSummary: result.decisionSummary ?? null,
          updatedAt: new Date(),
        })
        .where(eq(workflowStepRuns.id, step.id));
      await db
        .update(workflowRuns)
        .set({ status: "awaiting_approval", updatedAt: new Date() })
        .where(eq(workflowRuns.id, job.workflowRunId));
      await emitWorkflowEvent({
        organizationId: job.organizationId,
        workflowRunId: job.workflowRunId,
        stepRunId: step.id,
        type: "approval.requested",
        message: result.decisionSummary ?? "Approval required",
      });
      try {
        const { createApprovalRequest } = await import("../governance/engine");
        await createApprovalRequest({
          organizationId: job.organizationId,
          resourceType: "workflow_step",
          resourceId: step.id,
          title: `Workflow: ${step.name}`,
          summary: result.decisionSummary ?? "Approval required",
          payload: result.output ?? { stepId: step.id },
        });
      } catch (err) {
        console.warn("[workflow] approval queue sync failed:", (err as Error).message);
      }
      return;
    }

    await db
      .update(workflowStepRuns)
      .set({
        status: result.status === "skipped" ? "skipped" : "completed",
        output: outputJson,
        decisionSummary: result.decisionSummary ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowStepRuns.id, step.id));

    try {
      await db.insert(idempotencyRecords).values({
        id: randomUUID(),
        organizationId: job.organizationId,
        idempotencyKey,
        resourceType: "workflow_step",
        resourceId: step.id,
        result: outputJson,
        createdAt: new Date(),
      });
    } catch {
      // Duplicate idempotency key on rare races — safe to ignore.
    }

    await emitWorkflowEvent({
      organizationId: job.organizationId,
      workflowRunId: job.workflowRunId,
      stepRunId: step.id,
      type: result.status === "skipped" ? "step.skipped" : "step.completed",
      message: result.decisionSummary ?? `Step ${node.name} ${result.status}`,
    });

    await maybeEnqueueDownstream(job.organizationId, job.workflowRunId, step.nodeId);
    await maybeFinalizeRun(job.organizationId, job.workflowRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const maxAttempts = node.maxAttempts ?? 3;
    if (attempt < maxAttempts && (node.errorStrategy === "retry" || node.errorStrategy === "retry_with_backoff")) {
      const delayMs = node.errorStrategy === "retry_with_backoff" ? 2000 * attempt : 0;
      await db
        .update(workflowStepRuns)
        .set({
          status: "retrying",
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(workflowStepRuns.id, step.id));
      await emitWorkflowEvent({
        organizationId: job.organizationId,
        workflowRunId: job.workflowRunId,
        stepRunId: step.id,
        type: "step.retrying",
        message: `Retry ${attempt}/${maxAttempts}: ${message}`,
      });
      await enqueueStep(job.organizationId, job.workflowRunId, step.id, delayMs);
      return;
    }

    if (node.errorStrategy === "skip" || node.errorStrategy === "continue") {
      await db
        .update(workflowStepRuns)
        .set({
          status: "skipped",
          errorMessage: message,
          decisionSummary: `Skipped after error: ${message}`,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowStepRuns.id, step.id));
      await maybeEnqueueDownstream(job.organizationId, job.workflowRunId, step.nodeId);
      await maybeFinalizeRun(job.organizationId, job.workflowRunId);
      return;
    }

    await failStep(step.id, job, message);
  }
}

async function failStep(stepId: string, job: WorkflowStepJobData, message: string): Promise<void> {
  await db
    .update(workflowStepRuns)
    .set({
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowStepRuns.id, stepId));
  await db
    .update(workflowRuns)
    .set({ status: "failed", errorMessage: message, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(workflowRuns.id, job.workflowRunId));
  await emitWorkflowEvent({
    organizationId: job.organizationId,
    workflowRunId: job.workflowRunId,
    stepRunId: stepId,
    type: "step.failed",
    message,
  });
  await emitWorkflowEvent({
    organizationId: job.organizationId,
    workflowRunId: job.workflowRunId,
    type: "run.failed",
    message,
  });
}

async function maybeEnqueueDownstream(
  organizationId: string,
  workflowRunId: string,
  completedNodeId: string,
): Promise<void> {
  const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, workflowRunId)).limit(1);
  if (!run || run.status === "failed" || run.status === "cancelled") return;

  const compiled = await loadCompiled(run.workflowVersionId);
  const children = compiled.adjacency.get(completedNodeId) ?? [];
  if (!children.length) return;

  const childSteps = await db
    .select()
    .from(workflowStepRuns)
    .where(
      and(eq(workflowStepRuns.workflowRunId, workflowRunId), inArray(workflowStepRuns.nodeId, children)),
    );

  for (const child of childSteps) {
    if (!["pending", "queued"].includes(child.status) && child.status !== "retrying") continue;
    // Re-check parents inside processWorkflowStep; just enqueue candidates.
    if (child.status === "pending" || child.status === "retrying") {
      await enqueueStep(organizationId, workflowRunId, child.id, 0);
    }
  }
}

async function maybeFinalizeRun(organizationId: string, workflowRunId: string): Promise<void> {
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, workflowRunId), eq(workflowRuns.organizationId, organizationId)))
    .limit(1);
  if (!run) return;
  if (["failed", "cancelled", "completed", "completed_with_warnings", "awaiting_approval"].includes(run.status)) {
    return;
  }

  const steps = await db
    .select()
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.workflowRunId, workflowRunId));

  if (steps.some((s) => s.status === "awaiting_approval")) {
    await db
      .update(workflowRuns)
      .set({ status: "awaiting_approval", updatedAt: new Date() })
      .where(eq(workflowRuns.id, workflowRunId));
    return;
  }

  const unfinished = steps.filter(
    (s) =>
      !["completed", "skipped", "cancelled", "failed"].includes(s.status),
  );
  if (unfinished.length > 0) return;

  if (steps.some((s) => s.status === "failed")) {
    await db
      .update(workflowRuns)
      .set({ status: "failed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, workflowRunId));
    return;
  }

  const returnStep = steps.find((s) => s.nodeType === "output.return");
  const output = returnStep?.output ?? JSON.stringify(
    Object.fromEntries(steps.map((s) => [s.nodeId, parseJson(s.output, null)])),
  );

  const warnings = steps.some(
    (s) => s.nodeType === "output.notify" && (s.output ?? "").includes("Not configured"),
  );
  await db
    .update(workflowRuns)
    .set({
      status: warnings ? "completed_with_warnings" : "completed",
      output,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowRuns.id, workflowRunId));

  await emitWorkflowEvent({
    organizationId,
    workflowRunId,
    type: "run.completed",
    message: warnings ? "Run completed with warnings" : "Run completed",
  });
}

export async function approveWorkflowStep(params: {
  organizationId: string;
  stepRunId: string;
  userId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<void> {
  const [step] = await db
    .select()
    .from(workflowStepRuns)
    .where(
      and(
        eq(workflowStepRuns.id, params.stepRunId),
        eq(workflowStepRuns.organizationId, params.organizationId),
      ),
    )
    .limit(1);
  if (!step) throw new Error("Step not found");
  if (step.status !== "awaiting_approval") throw new Error("Step is not awaiting approval");

  if (params.decision === "rejected") {
    await db
      .update(workflowStepRuns)
      .set({
        status: "failed",
        errorMessage: params.note ?? "Rejected by human",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowStepRuns.id, step.id));
    await db
      .update(workflowRuns)
      .set({
        status: "failed",
        errorMessage: params.note ?? "Rejected by human",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, step.workflowRunId));
    await emitWorkflowEvent({
      organizationId: params.organizationId,
      workflowRunId: step.workflowRunId,
      stepRunId: step.id,
      type: "approval.rejected",
      message: params.note ?? "Rejected",
      payload: { userId: params.userId },
    });
    return;
  }

  await db
    .update(workflowStepRuns)
    .set({
      status: "completed",
      decisionSummary: params.note ?? "Approved",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowStepRuns.id, step.id));

  await db
    .update(workflowRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(workflowRuns.id, step.workflowRunId));

  await emitWorkflowEvent({
    organizationId: params.organizationId,
    workflowRunId: step.workflowRunId,
    stepRunId: step.id,
    type: "approval.approved",
    message: params.note ?? "Approved",
    payload: { userId: params.userId },
  });

  await maybeEnqueueDownstream(params.organizationId, step.workflowRunId, step.nodeId);
  await maybeFinalizeRun(params.organizationId, step.workflowRunId);
}

export async function cancelWorkflowRun(params: {
  organizationId: string;
  runId: string;
}): Promise<void> {
  await db
    .update(workflowRuns)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(workflowRuns.id, params.runId), eq(workflowRuns.organizationId, params.organizationId)),
    );
  await db
    .update(workflowStepRuns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(workflowStepRuns.workflowRunId, params.runId),
        inArray(workflowStepRuns.status, ["pending", "queued", "running", "waiting", "retrying"]),
      ),
    );
  await emitWorkflowEvent({
    organizationId: params.organizationId,
    workflowRunId: params.runId,
    type: "run.cancelled",
    message: "Run cancelled",
  });
}

export type { WorkflowGraph };
