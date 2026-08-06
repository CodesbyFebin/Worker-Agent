/** Client-side workflow graph helpers aligned with server Phase 3+ / YouTube Studio types. */

export const WORKFLOW_NODE_TYPES = [
  "trigger.manual",
  "logic.transform",
  "logic.condition",
  "logic.delay",
  "logic.merge",
  "human.approval",
  "agent.task",
  "video.script",
  "video.voice",
  "video.broll",
  "video.assemble",
  "video.compliance",
  "youtube.upload",
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
  category: "trigger" | "logic" | "agent" | "human" | "output" | "youtube";
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
    type: "video.script",
    label: "YT Script",
    blurb: "Scriptwriter agent (hook / PSR / CTA)",
    category: "youtube",
    defaultConfig: { topic: "{{input.topic}}", lengthMinutes: 10 },
  },
  {
    type: "video.compliance",
    label: "Sanity Shield",
    blurb: "Pre-upload compliance keyword scan",
    category: "youtube",
    defaultConfig: { fromNode: "script" },
  },
  {
    type: "video.voice",
    label: "YT Voice",
    blurb: "ElevenLabs or StreamElements TTS",
    category: "youtube",
    defaultConfig: { fromNode: "script" },
  },
  {
    type: "video.broll",
    label: "YT B-roll",
    blurb: "Royalty-free Pexels clips",
    category: "youtube",
    defaultConfig: { fromNode: "script" },
  },
  {
    type: "video.assemble",
    label: "YT Assemble",
    blurb: "FFmpeg mux voice + visuals",
    category: "youtube",
    defaultConfig: { scriptNode: "script", voiceNode: "voice", brollNode: "broll" },
  },
  {
    type: "youtube.upload",
    label: "YT Upload",
    blurb: "Upload via channel OAuth env key",
    category: "youtube",
    defaultConfig: { privacyStatus: "private" },
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

/** Mirrors server youtubeLongFormTemplate for UI seeding. */
export function youtubeLongFormTemplate(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger.manual",
        name: "Start",
        config: {},
        position: { x: 40, y: 180 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
      {
        id: "script",
        type: "video.script",
        name: "Script",
        config: { topic: "{{input.topic}}", tone: "curious", lengthMinutes: 10 },
        position: { x: 260, y: 180 },
        errorStrategy: "retry_with_backoff",
        maxAttempts: 3,
      },
      {
        id: "compliance",
        type: "video.compliance",
        name: "Sanity Shield",
        config: { fromNode: "script" },
        position: { x: 480, y: 180 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
      {
        id: "voice",
        type: "video.voice",
        name: "Voice",
        config: { fromNode: "script" },
        position: { x: 700, y: 100 },
        errorStrategy: "retry_with_backoff",
        maxAttempts: 2,
      },
      {
        id: "broll",
        type: "video.broll",
        name: "B-roll",
        config: { fromNode: "script" },
        position: { x: 700, y: 280 },
        errorStrategy: "continue",
        maxAttempts: 2,
      },
      {
        id: "assemble",
        type: "video.assemble",
        name: "Assemble",
        config: { scriptNode: "script", voiceNode: "voice", brollNode: "broll" },
        position: { x: 920, y: 180 },
        errorStrategy: "retry_with_backoff",
        maxAttempts: 2,
      },
      {
        id: "upload",
        type: "youtube.upload",
        name: "Upload",
        config: { assembleNode: "assemble", scriptNode: "script", privacyStatus: "private" },
        position: { x: 1140, y: 180 },
        errorStrategy: "stop_workflow",
        maxAttempts: 2,
      },
      {
        id: "return",
        type: "output.return",
        name: "Return",
        config: { fromNode: "upload" },
        position: { x: 1360, y: 180 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "script" },
      { id: "e2", source: "script", target: "compliance" },
      { id: "e3", source: "compliance", target: "voice" },
      { id: "e4", source: "compliance", target: "broll" },
      { id: "e5", source: "voice", target: "assemble" },
      { id: "e6", source: "broll", target: "assemble" },
      { id: "e7", source: "assemble", target: "upload" },
      { id: "e8", source: "upload", target: "return" },
    ],
  };
}
