import { z } from "zod";

/** Node types implemented in Phase 3+ runtime (YouTube Studio Phase 11). */
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
  "python.caption",
  "python.audio.analyze",
  "python.thumbnail.score",
  "python.virality.check",
  "output.return",
  "output.notify",
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const workflowNodeSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(WORKFLOW_NODE_TYPES),
  name: z.string().min(1).max(255),
  config: z.record(z.unknown()).default({}),
  /** Canvas position (Phase 4 visual builder). Ignored by the runtime. */
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  /** When true, step requires human approval before completing (or is human.approval). */
  requiresApproval: z.boolean().optional(),
  errorStrategy: z
    .enum([
      "stop_workflow",
      "retry",
      "retry_with_backoff",
      "continue",
      "skip",
      "request_human_input",
    ])
    .default("stop_workflow"),
  maxAttempts: z.number().int().min(1).max(10).default(3),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1).max(128),
  source: z.string().min(1),
  target: z.string().min(1),
  /** Optional condition label / branch key (e.g. "true" | "false"). */
  label: z.string().max(64).optional(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1).max(200),
  edges: z.array(workflowEdgeSchema).max(400),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;

export type CompileIssue = { severity: "error" | "warning"; message: string; nodeId?: string };

export type CompiledWorkflow = {
  graph: WorkflowGraph;
  triggers: WorkflowNode[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
  issues: CompileIssue[];
};

export function compileWorkflowGraph(raw: unknown): CompiledWorkflow {
  const parsed = workflowGraphSchema.parse(raw);
  const issues: CompileIssue[] = [];
  const ids = new Set(parsed.nodes.map((n) => n.id));

  if (ids.size !== parsed.nodes.length) {
    issues.push({ severity: "error", message: "Duplicate node ids" });
  }

  for (const edge of parsed.edges) {
    if (!ids.has(edge.source)) {
      issues.push({ severity: "error", message: `Edge source missing: ${edge.source}`, nodeId: edge.source });
    }
    if (!ids.has(edge.target)) {
      issues.push({ severity: "error", message: `Edge target missing: ${edge.target}`, nodeId: edge.target });
    }
  }

  const triggers = parsed.nodes.filter((n) => n.type.startsWith("trigger."));
  if (triggers.length === 0) {
    issues.push({ severity: "error", message: "Workflow needs at least one trigger node" });
  }

  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const n of parsed.nodes) {
    adjacency.set(n.id, []);
    reverseAdjacency.set(n.id, []);
  }
  for (const e of parsed.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    adjacency.get(e.source)!.push(e.target);
    reverseAdjacency.get(e.target)!.push(e.source);
  }

  // Cycle detection (DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const n of parsed.nodes) {
    if (visit(n.id)) {
      issues.push({ severity: "error", message: "Workflow graph contains a cycle", nodeId: n.id });
      break;
    }
  }

  const returns = parsed.nodes.filter((n) => n.type === "output.return" || n.type === "output.notify");
  if (returns.length === 0) {
    issues.push({ severity: "warning", message: "No output node — run may complete with empty output" });
  }

  return { graph: parsed, triggers, adjacency, reverseAdjacency, issues };
}

export function hasCompileErrors(compiled: CompiledWorkflow): boolean {
  return compiled.issues.some((i) => i.severity === "error");
}

/** Default starter graph for new drafts. */
export function defaultManualWorkflowGraph(goalLabel = "Goal"): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger.manual",
        name: "Manual start",
        config: {},
        position: { x: 80, y: 160 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
      {
        id: "transform",
        type: "logic.transform",
        name: "Normalize input",
        config: {
          template: { goal: "{{input.goal}}", note: goalLabel },
        },
        position: { x: 320, y: 160 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
      {
        id: "agent",
        type: "agent.task",
        name: "Agent task",
        config: {
          prompt: "Summarize this goal in one sentence and list 3 concrete next steps:\n{{input.goal}}",
        },
        position: { x: 560, y: 160 },
        errorStrategy: "retry_with_backoff",
        maxAttempts: 3,
      },
      {
        id: "approval",
        type: "human.approval",
        name: "Human approval",
        config: { summary: "Approve agent output before finishing" },
        position: { x: 800, y: 160 },
        requiresApproval: true,
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
      {
        id: "return",
        type: "output.return",
        name: "Return result",
        config: {},
        position: { x: 1040, y: 160 },
        errorStrategy: "stop_workflow",
        maxAttempts: 1,
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "transform" },
      { id: "e2", source: "transform", target: "agent" },
      { id: "e3", source: "agent", target: "approval" },
      { id: "e4", source: "approval", target: "return" },
    ],
  };
}

/** Long-form YouTube pipeline template (Phase 11). */
export function youtubeLongFormTemplate(topicPlaceholder = "{{input.topic}}"): WorkflowGraph {
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
        config: { topic: topicPlaceholder, tone: "curious", lengthMinutes: 10 },
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
        id: "caption",
        type: "python.caption",
        name: "Captions (WhisperX)",
        config: { fromNode: "assemble" },
        position: { x: 1140, y: 180 },
        errorStrategy: "retry_with_backoff",
        maxAttempts: 2,
      },
      {
        id: "upload",
        type: "youtube.upload",
        name: "Upload",
        config: {
          assembleNode: "assemble",
          captionNode: "caption",
          scriptNode: "script",
          privacyStatus: "private",
        },
        position: { x: 1320, y: 180 },
        errorStrategy: "stop_workflow",
        maxAttempts: 2,
      },
      {
        id: "return",
        type: "output.return",
        name: "Return",
        config: { fromNode: "upload" },
        position: { x: 1540, y: 180 },
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
      { id: "e7", source: "assemble", target: "caption" },
      { id: "e7b", source: "caption", target: "upload" },
      { id: "e8", source: "upload", target: "return" },
    ],
  };
}
