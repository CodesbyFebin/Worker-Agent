import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  agentDefinitions,
  agentEvaluations,
  agentEvaluationRuns,
  agentExecutions,
  agentVersions,
  modelPolicies,
  promptDefinitions,
  promptVersions,
  toolPolicies,
} from "../../../drizzle/schema";
import { db } from "../../_core/db";
import { routeComplete } from "../llm/router";
import { env } from "../../_core/env";
import type { AgentRole } from "../../../shared/types";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type AgentTestCase = {
  input: string;
  expectContains?: string[];
  forbidContains?: string[];
  maxCostUsd?: number;
};

export type ResolvedAgent = {
  agent: typeof agentDefinitions.$inferSelect;
  version: typeof agentVersions.$inferSelect;
  systemPrompt: string;
  modelPolicy: typeof modelPolicies.$inferSelect;
  toolPolicy: typeof toolPolicies.$inferSelect;
  capabilities: string[];
  allowedTools: string[];
};

export async function resolveAgent(
  organizationId: string,
  agentDefinitionId: string,
): Promise<ResolvedAgent> {
  const [agent] = await db
    .select()
    .from(agentDefinitions)
    .where(
      and(
        eq(agentDefinitions.id, agentDefinitionId),
        eq(agentDefinitions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!agent) throw new Error(`Agent definition not found: ${agentDefinitionId}`);
  if (!agent.currentVersionId) throw new Error(`Agent ${agent.name} has no published version`);
  if (agent.status === "disabled") throw new Error(`Agent ${agent.name} is disabled`);

  const [version] = await db
    .select()
    .from(agentVersions)
    .where(eq(agentVersions.id, agent.currentVersionId))
    .limit(1);
  if (!version) throw new Error(`Agent version missing for ${agent.name}`);

  const [prompt] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, version.promptVersionId))
    .limit(1);
  if (!prompt) throw new Error(`Prompt version missing for agent ${agent.name}`);

  const [modelPolicy] = await db
    .select()
    .from(modelPolicies)
    .where(eq(modelPolicies.id, version.modelPolicyId))
    .limit(1);
  if (!modelPolicy) throw new Error(`Model policy missing for agent ${agent.name}`);

  const [toolPolicy] = await db
    .select()
    .from(toolPolicies)
    .where(eq(toolPolicies.id, version.toolPolicyId))
    .limit(1);
  if (!toolPolicy) throw new Error(`Tool policy missing for agent ${agent.name}`);

  return {
    agent,
    version,
    systemPrompt: prompt.systemPrompt,
    modelPolicy,
    toolPolicy,
    capabilities: parseJson<string[]>(version.capabilities, []),
    allowedTools: parseJson<string[]>(toolPolicy.allowedTools, []),
  };
}

/** Find an active org agent by role, or null. */
export async function findActiveAgentByRole(
  organizationId: string,
  role: string,
): Promise<typeof agentDefinitions.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(agentDefinitions)
    .where(
      and(
        eq(agentDefinitions.organizationId, organizationId),
        eq(agentDefinitions.role, role),
        eq(agentDefinitions.status, "active"),
      ),
    )
    .orderBy(desc(agentDefinitions.updatedAt))
    .limit(1);
  return row ?? null;
}

export type ExecuteAgentParams = {
  organizationId: string;
  agentDefinitionId: string;
  prompt: string;
  workflowRunId?: string;
  workflowStepRunId?: string;
};

export type ExecuteAgentResult = {
  executionId: string;
  text: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  decisionSummary: string;
  capabilities: string[];
  allowedTools: string[];
};

function estimateCostUsd(inputTokens: number | null, outputTokens: number | null): number | null {
  if (inputTokens == null && outputTokens == null) return null;
  const inT = inputTokens ?? 0;
  const outT = outputTokens ?? 0;
  return (
    (inT / 1_000_000) * env.PRICE_PER_MILLION_INPUT_TOKENS_USD +
    (outT / 1_000_000) * env.PRICE_PER_MILLION_OUTPUT_TOKENS_USD
  );
}

export async function executeAgentDefinition(params: ExecuteAgentParams): Promise<ExecuteAgentResult> {
  const { assertBudgetAllows } = await import("../governance/engine");
  const budget = await assertBudgetAllows(params.organizationId);
  if (!budget.allowed) {
    throw new Error(budget.reason ?? "Org budget exceeded");
  }

  const resolved = await resolveAgent(params.organizationId, params.agentDefinitionId);
  const executionId = randomUUID();
  const startedAt = new Date();
  const inputPayload = JSON.stringify({
    prompt: params.prompt,
    capabilities: resolved.capabilities,
    allowedTools: resolved.allowedTools,
  });

  await db.insert(agentExecutions).values({
    id: executionId,
    organizationId: params.organizationId,
    agentId: resolved.agent.id,
    agentVersionId: resolved.version.id,
    workflowRunId: params.workflowRunId ?? null,
    workflowStepRunId: params.workflowStepRunId ?? null,
    modelProvider: resolved.modelPolicy.preferredProvider ?? "auto",
    modelName: resolved.modelPolicy.preferredModel ?? "default",
    status: "running",
    input: inputPayload,
    startedAt,
  });

  try {
    const result = await routeComplete({
      system: resolved.systemPrompt,
      prompt: params.prompt,
      maxTokens: resolved.modelPolicy.maxTokens,
      model: resolved.modelPolicy.preferredModel ?? undefined,
    });
    const costUsd = estimateCostUsd(result.inputTokens, result.outputTokens);
    const decisionSummary = `Agent ${resolved.agent.name} v${resolved.version.version} via ${result.provider}/${result.model}`;

    await db
      .update(agentExecutions)
      .set({
        status: "completed",
        modelProvider: result.provider,
        modelName: result.model,
        output: JSON.stringify({ text: result.text }),
        decisionSummary,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: costUsd != null ? String(costUsd) : null,
        completedAt: new Date(),
      })
      .where(eq(agentExecutions.id, executionId));

    return {
      executionId,
      text: result.text,
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      decisionSummary,
      capabilities: resolved.capabilities,
      allowedTools: resolved.allowedTools,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agentExecutions)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(eq(agentExecutions.id, executionId));
    throw err;
  }
}

/** Fallback when workflow step has no agentDefinitionId and no role match. */
export async function executeEphemeralAgent(params: {
  organizationId: string;
  prompt: string;
  systemPrompt?: string;
  workflowRunId?: string;
  workflowStepRunId?: string;
}): Promise<ExecuteAgentResult> {
  const executionId = randomUUID();
  const system =
    params.systemPrompt ??
    "You are a workflow agent step in WorkerAgent.Cloud. Be concise and actionable. " +
      "Do not invent tooling success — only reason about the given input.";
  const startedAt = new Date();

  await db.insert(agentExecutions).values({
    id: executionId,
    organizationId: params.organizationId,
    agentId: null,
    agentVersionId: null,
    workflowRunId: params.workflowRunId ?? null,
    workflowStepRunId: params.workflowStepRunId ?? null,
    modelProvider: "auto",
    modelName: "default",
    status: "running",
    input: JSON.stringify({ prompt: params.prompt, ephemeral: true }),
    startedAt,
  });

  try {
    const result = await routeComplete({
      system,
      prompt: params.prompt,
      maxTokens: 1024,
    });
    const costUsd = estimateCostUsd(result.inputTokens, result.outputTokens);
    const decisionSummary = `Ephemeral agent via ${result.provider}/${result.model} (no agent definition bound)`;

    await db
      .update(agentExecutions)
      .set({
        status: "completed",
        modelProvider: result.provider,
        modelName: result.model,
        output: JSON.stringify({ text: result.text }),
        decisionSummary,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: costUsd != null ? String(costUsd) : null,
        completedAt: new Date(),
      })
      .where(eq(agentExecutions.id, executionId));

    return {
      executionId,
      text: result.text,
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      decisionSummary,
      capabilities: [],
      allowedTools: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agentExecutions)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(agentExecutions.id, executionId));
    throw err;
  }
}

export async function createAgentWithVersion(params: {
  organizationId: string;
  userId: string;
  name: string;
  description: string;
  role: AgentRole | string;
  systemPrompt: string;
  capabilities?: string[];
  allowedTools?: string[];
  modelPolicyKey?: string;
  preferredProvider?: string | null;
  preferredModel?: string | null;
  maxTokens?: number;
  activate?: boolean;
}): Promise<{ agentId: string; versionId: string }> {
  const agentId = randomUUID();
  const promptId = randomUUID();
  const promptVersionId = randomUUID();
  const modelPolicyId = randomUUID();
  const toolPolicyId = randomUUID();
  const versionId = randomUUID();
  const capabilities = params.capabilities ?? [params.role];
  const allowedTools = params.allowedTools ?? [];

  await db.insert(promptDefinitions).values({
    id: promptId,
    organizationId: params.organizationId,
    name: `${params.name} prompt`,
  });
  await db.insert(promptVersions).values({
    id: promptVersionId,
    promptId,
    organizationId: params.organizationId,
    version: 1,
    systemPrompt: params.systemPrompt,
    changeSummary: "Initial prompt",
    createdBy: params.userId,
  });
  await db.insert(modelPolicies).values({
    id: modelPolicyId,
    organizationId: params.organizationId,
    name: `${params.name} model`,
    policyKey: params.modelPolicyKey ?? "general",
    preferredProvider: params.preferredProvider ?? null,
    preferredModel: params.preferredModel ?? null,
    maxTokens: params.maxTokens ?? 1024,
    temperature: "0.20",
    fallbackProviders: null,
  });
  await db.insert(toolPolicies).values({
    id: toolPolicyId,
    organizationId: params.organizationId,
    name: `${params.name} tools`,
    allowedTools: JSON.stringify(allowedTools),
  });
  await db.insert(agentDefinitions).values({
    id: agentId,
    organizationId: params.organizationId,
    name: params.name,
    description: params.description,
    role: params.role,
    currentVersionId: null,
    status: "draft",
    createdBy: params.userId,
  });
  await db.insert(agentVersions).values({
    id: versionId,
    agentId,
    organizationId: params.organizationId,
    version: 1,
    promptVersionId,
    modelPolicyId,
    toolPolicyId,
    capabilities: JSON.stringify(capabilities),
    changeSummary: "Initial version",
    createdBy: params.userId,
  });
  await db
    .update(agentDefinitions)
    .set({
      currentVersionId: versionId,
      status: params.activate === false ? "draft" : "active",
      updatedAt: new Date(),
    })
    .where(eq(agentDefinitions.id, agentId));

  return { agentId, versionId };
}

export async function publishNewAgentVersion(params: {
  organizationId: string;
  userId: string;
  agentId: string;
  systemPrompt?: string;
  capabilities?: string[];
  allowedTools?: string[];
  preferredProvider?: string | null;
  preferredModel?: string | null;
  maxTokens?: number;
  changeSummary?: string;
}): Promise<{ versionId: string; version: number }> {
  const resolved = await resolveAgent(params.organizationId, params.agentId);
  const nextVersion = resolved.version.version + 1;

  const promptVersionId = randomUUID();
  await db.insert(promptVersions).values({
    id: promptVersionId,
    promptId: (
      await db
        .select({ promptId: promptVersions.promptId })
        .from(promptVersions)
        .where(eq(promptVersions.id, resolved.version.promptVersionId))
        .limit(1)
    )[0]!.promptId,
    organizationId: params.organizationId,
    version: nextVersion,
    systemPrompt: params.systemPrompt ?? resolved.systemPrompt,
    changeSummary: params.changeSummary ?? `Version ${nextVersion}`,
    createdBy: params.userId,
  });

  const modelPolicyId = randomUUID();
  await db.insert(modelPolicies).values({
    id: modelPolicyId,
    organizationId: params.organizationId,
    name: `${resolved.agent.name} model v${nextVersion}`,
    policyKey: resolved.modelPolicy.policyKey,
    preferredProvider:
      params.preferredProvider !== undefined
        ? params.preferredProvider
        : resolved.modelPolicy.preferredProvider,
    preferredModel:
      params.preferredModel !== undefined ? params.preferredModel : resolved.modelPolicy.preferredModel,
    maxTokens: params.maxTokens ?? resolved.modelPolicy.maxTokens,
    temperature: resolved.modelPolicy.temperature,
    fallbackProviders: resolved.modelPolicy.fallbackProviders,
  });

  const toolPolicyId = randomUUID();
  await db.insert(toolPolicies).values({
    id: toolPolicyId,
    organizationId: params.organizationId,
    name: `${resolved.agent.name} tools v${nextVersion}`,
    allowedTools: JSON.stringify(params.allowedTools ?? resolved.allowedTools),
  });

  const versionId = randomUUID();
  await db.insert(agentVersions).values({
    id: versionId,
    agentId: params.agentId,
    organizationId: params.organizationId,
    version: nextVersion,
    promptVersionId,
    modelPolicyId,
    toolPolicyId,
    capabilities: JSON.stringify(params.capabilities ?? resolved.capabilities),
    changeSummary: params.changeSummary ?? `Version ${nextVersion}`,
    createdBy: params.userId,
  });
  await db
    .update(agentDefinitions)
    .set({ currentVersionId: versionId, status: "active", updatedAt: new Date() })
    .where(eq(agentDefinitions.id, params.agentId));

  return { versionId, version: nextVersion };
}

export async function scoreEvaluation(params: {
  organizationId: string;
  evaluationId: string;
}): Promise<{
  runId: string;
  passed: boolean;
  score: number;
  details: string;
  executionId: string;
}> {
  const [evaluation] = await db
    .select()
    .from(agentEvaluations)
    .where(
      and(
        eq(agentEvaluations.id, params.evaluationId),
        eq(agentEvaluations.organizationId, params.organizationId),
      ),
    )
    .limit(1);
  if (!evaluation) throw new Error("Evaluation not found");

  const testCase = parseJson<AgentTestCase>(evaluation.testCase, { input: "" });
  if (!testCase.input) throw new Error("Evaluation test case missing input");

  const exec = await executeAgentDefinition({
    organizationId: params.organizationId,
    agentDefinitionId: evaluation.agentId,
    prompt: testCase.input,
  });

  const textLower = exec.text.toLowerCase();
  const failures: string[] = [];
  for (const needle of testCase.expectContains ?? []) {
    if (!textLower.includes(needle.toLowerCase())) {
      failures.push(`Missing expected text: ${needle}`);
    }
  }
  for (const needle of testCase.forbidContains ?? []) {
    if (textLower.includes(needle.toLowerCase())) {
      failures.push(`Forbidden text present: ${needle}`);
    }
  }
  if (testCase.maxCostUsd != null && exec.costUsd != null && exec.costUsd > testCase.maxCostUsd) {
    failures.push(`Cost ${exec.costUsd} exceeded max ${testCase.maxCostUsd}`);
  }

  const passed = failures.length === 0;
  const expectCount = (testCase.expectContains ?? []).length;
  const hit =
    expectCount === 0
      ? passed
        ? 1
        : 0
      : (testCase.expectContains ?? []).filter((n) => textLower.includes(n.toLowerCase())).length /
        expectCount;
  const score = Math.max(0, Math.min(1, passed ? hit : hit * 0.5));

  const runId = randomUUID();
  const details = JSON.stringify({
    failures,
    provider: exec.provider,
    model: exec.model,
    preview: exec.text.slice(0, 500),
  });

  const [agent] = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.id, evaluation.agentId))
    .limit(1);

  await db.insert(agentEvaluationRuns).values({
    id: runId,
    organizationId: params.organizationId,
    evaluationId: evaluation.id,
    agentVersionId: agent?.currentVersionId ?? null,
    agentExecutionId: exec.executionId,
    passed,
    score: String(score),
    details,
  });

  return { runId, passed, score, details, executionId: exec.executionId };
}

export async function listAgentUsage(organizationId: string, agentId?: string) {
  const conditions = [eq(agentExecutions.organizationId, organizationId)];
  if (agentId) conditions.push(eq(agentExecutions.agentId, agentId));

  const rows = await db
    .select({
      count: sql<number>`count(*)`,
      completed: sql<number>`sum(case when ${agentExecutions.status} = 'completed' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${agentExecutions.status} = 'failed' then 1 else 0 end)`,
      inputTokens: sql<number>`coalesce(sum(${agentExecutions.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${agentExecutions.outputTokens}), 0)`,
    })
    .from(agentExecutions)
    .where(and(...conditions));

  return rows[0] ?? { count: 0, completed: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
}
