import {
  executeAgentDefinition,
  executeEphemeralAgent,
  findActiveAgentByRole,
} from "../agent/runtime";
import type { WorkflowNode } from "./types";

export type StepContext = {
  organizationId: string;
  workflowRunId: string;
  stepRunId: string;
  runInput: Record<string, unknown>;
  /** Outputs keyed by completed parent node id. */
  parentOutputs: Record<string, unknown>;
  node: WorkflowNode;
};

function deepGet(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Replace {{input.x}} and {{nodes.nodeId.field}} in strings. */
export function interpolate(template: string, ctx: StepContext): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const key = expr.trim();
    if (key.startsWith("input.")) {
      const v = deepGet(ctx.runInput, key.slice("input.".length));
      return v == null ? "" : String(v);
    }
    if (key.startsWith("nodes.")) {
      const rest = key.slice("nodes.".length);
      const [nodeId, ...path] = rest.split(".");
      const base = ctx.parentOutputs[nodeId!];
      const v = path.length ? deepGet(base, path.join(".")) : base;
      return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    }
    return "";
  });
}

function interpolateValue(value: unknown, ctx: StepContext): unknown {
  if (typeof value === "string") return interpolate(value, ctx);
  if (Array.isArray(value)) return value.map((v) => interpolateValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateValue(v, ctx);
    }
    return out;
  }
  return value;
}

export type StepResult =
  | { status: "completed"; output: unknown; decisionSummary?: string }
  | { status: "awaiting_approval"; output: unknown; decisionSummary?: string }
  | { status: "skipped"; output?: unknown; decisionSummary?: string };

export async function executeNode(ctx: StepContext): Promise<StepResult> {
  const { node } = ctx;
  switch (node.type) {
    case "trigger.manual":
      return {
        status: "completed",
        output: { triggered: true, input: ctx.runInput },
        decisionSummary: "Manual trigger accepted run input",
      };

    case "logic.transform": {
      const template = node.config.template ?? { ...ctx.runInput, ...ctx.parentOutputs };
      const output = interpolateValue(template, ctx);
      return {
        status: "completed",
        output,
        decisionSummary: "Transformed inputs via template",
      };
    }

    case "logic.condition": {
      const expression = String(node.config.expression ?? "true");
      const resolved = interpolate(expression, ctx);
      // Minimal safe eval: only allow true/false/1/0/"yes"/"no" after interpolate,
      // or equality checks like `value==foo`.
      let pass = false;
      if (/^(true|1|yes)$/i.test(resolved.trim())) pass = true;
      else if (/^(false|0|no|)$/i.test(resolved.trim())) pass = false;
      else if (resolved.includes("==")) {
        const [l, r] = resolved.split("==").map((s) => s.trim());
        pass = l === r;
      } else {
        pass = Boolean(resolved);
      }
      return {
        status: "completed",
        output: { pass, expression: resolved },
        decisionSummary: `Condition evaluated to ${pass}`,
      };
    }

    case "logic.delay": {
      // Delay is handled by the scheduler via job delay; executor is a no-op marker.
      const delayMs = Number(node.config.delayMs ?? 0);
      return {
        status: "completed",
        output: { delayedMs: delayMs },
        decisionSummary: `Delay of ${delayMs}ms elapsed`,
      };
    }

    case "logic.merge": {
      return {
        status: "completed",
        output: { merged: ctx.parentOutputs },
        decisionSummary: "Merged parent branch outputs",
      };
    }

    case "human.approval": {
      return {
        status: "awaiting_approval",
        output: {
          summary: interpolate(String(node.config.summary ?? node.name), ctx),
          parents: ctx.parentOutputs,
        },
        decisionSummary: "Waiting for human approval",
      };
    }

    case "agent.task": {
      const prompt = interpolate(String(node.config.prompt ?? "{{input.goal}}"), ctx);
      const configuredId =
        typeof node.config.agentDefinitionId === "string" && node.config.agentDefinitionId
          ? node.config.agentDefinitionId
          : null;
      const roleHint =
        typeof node.config.agentRole === "string" && node.config.agentRole
          ? node.config.agentRole
          : null;

      let agentDefinitionId = configuredId;
      if (!agentDefinitionId && roleHint) {
        const byRole = await findActiveAgentByRole(ctx.organizationId, roleHint);
        agentDefinitionId = byRole?.id ?? null;
      }

      const result = agentDefinitionId
        ? await executeAgentDefinition({
            organizationId: ctx.organizationId,
            agentDefinitionId,
            prompt,
            workflowRunId: ctx.workflowRunId,
            workflowStepRunId: ctx.stepRunId,
          })
        : await executeEphemeralAgent({
            organizationId: ctx.organizationId,
            prompt,
            workflowRunId: ctx.workflowRunId,
            workflowStepRunId: ctx.stepRunId,
          });

      return {
        status: "completed",
        output: {
          text: result.text,
          prompt,
          executionId: result.executionId,
          agentDefinitionId,
          provider: result.provider,
          model: result.model,
          capabilities: result.capabilities,
          allowedTools: result.allowedTools,
        },
        decisionSummary: result.decisionSummary,
      };
    }

    case "output.return": {
      const pick = node.config.fromNode ? ctx.parentOutputs[String(node.config.fromNode)] : ctx.parentOutputs;
      return {
        status: "completed",
        output: pick ?? ctx.parentOutputs,
        decisionSummary: "Collected workflow output",
      };
    }

    case "output.notify": {
      // Real notify adapters land later — record intent only, never fake delivery.
      return {
        status: "completed",
        output: {
          notified: false,
          reason: "Not configured — no notify adapter (email/webhook) bound",
          message: interpolate(String(node.config.message ?? ""), ctx),
        },
        decisionSummary: "Notify skipped: adapter not configured",
      };
    }

    default:
      return {
        status: "skipped",
        output: { error: `Unsupported node type` },
        decisionSummary: `Node type not implemented`,
      };
  }
}
