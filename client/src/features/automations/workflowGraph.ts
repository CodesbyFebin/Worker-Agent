/** Client-side workflow graph helpers aligned with server Phase 3 types. */

export const WORKFLOW_NODE_TYPES = [
  "trigger.manual",
  "logic.transform",
  "logic.condition",
  "logic.delay",
  "logic.merge",
  "human.approval",
  "agent.task",
  "output.return",
  "output.notify",
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export type ErrorStrategy =
  | "stop_workflow"
  | "retry"
  | "retry_with_backoff"
  | "continue"
  | "skip"
  | "request_human_input";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  requiresApproval?: boolean;
  errorStrategy?: ErrorStrategy;
  maxAttempts?: number;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type StepStatus =
  | "pending"
  | "queued"
  | "assigned"
  | "running"
  | "waiting"
  | "awaiting_input"
  | "awaiting_approval"
  | "retrying"
  | "blocked"
  | "cancel_requested"
  | "cancelled"
  | "completed"
  | "failed"
  | "expired"
  | "skipped";

export const NODE_LIBRARY: Array<{
  type: WorkflowNodeType;
  label: string;
  blurb: string;
  category: "trigger" | "logic" | "agent" | "human" | "output";
  defaultConfig: Record<string, unknown>;
}> = [
  {
    type: "trigger.manual",
    label: "Manual trigger",
    blurb: "Start a run from the UI",
    category: "trigger",
    defaultConfig: {},
  },
  {
    type: "logic.transform",
    label: "Transform",
    blurb: "Map / template inputs",
    category: "logic",
    defaultConfig: { template: { goal: "{{input.goal}}" } },
  },
  {
    type: "logic.condition",
    label: "Condition",
    blurb: "Branch on true/false",
    category: "logic",
    defaultConfig: { expression: "true" },
  },
  {
    type: "logic.delay",
    label: "Delay",
    blurb: "Wait before continuing",
    category: "logic",
    defaultConfig: { delayMs: 5000 },
  },
  {
    type: "logic.merge",
    label: "Merge",
    blurb: "Fan-in parent outputs",
    category: "logic",
    defaultConfig: {},
  },
  {
    type: "agent.task",
    label: "Agent task",
    blurb: "LLM step via model router",
    category: "agent",
    defaultConfig: { prompt: "{{input.goal}}" },
  },
  {
    type: "human.approval",
    label: "Human approval",
    blurb: "Pause until approved",
    category: "human",
    defaultConfig: { summary: "Approve before continuing" },
  },
  {
    type: "output.return",
    label: "Return",
    blurb: "Collect run output",
    category: "output",
    defaultConfig: {},
  },
  {
    type: "output.notify",
    label: "Notify",
    blurb: "Notify adapter (must be configured)",
    category: "output",
    defaultConfig: { message: "Workflow finished" },
  },
];

export function statusColor(status?: StepStatus | string): string {
  switch (status) {
    case "running":
    case "assigned":
    case "queued":
    case "retrying":
      return "var(--color-amber)";
    case "completed":
      return "var(--color-teal)";
    case "failed":
    case "blocked":
    case "cancelled":
      return "var(--color-coral)";
    case "awaiting_approval":
    case "awaiting_input":
      return "var(--color-violet)";
    case "waiting":
    case "skipped":
      return "var(--color-text-muted)";
    default:
      return "var(--color-line)";
  }
}

export function autoLayoutPositions(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n, i) => ({
    ...n,
    position: n.position ?? { x: 80 + (i % 5) * 240, y: 80 + Math.floor(i / 5) * 140 },
  }));
}

let seq = 0;
export function newNodeId(type: WorkflowNodeType): string {
  seq += 1;
  return `${type.replace(".", "_")}_${Date.now().toString(36)}_${seq}`;
}
