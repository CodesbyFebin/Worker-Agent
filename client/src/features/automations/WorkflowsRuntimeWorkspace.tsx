import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";
import { NodePalette, WorkflowCanvas } from "./canvas/WorkflowCanvas";
import { NodeInspector } from "./canvas/NodeInspector";
import {
  autoLayoutPositions,
  type StepStatus,
  type WorkflowGraph,
  type WorkflowNode,
} from "./workflowGraph";

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

/**
 * Automations — visual workflow builder + durable run inspector (Phase 4).
 */
export function WorkflowsRuntimeWorkspace() {
  const utils = trpc.useUtils();
  const { data: workflows, isLoading, error } = trpc.workflow.list.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [goal, setGoal] = useState("Research AI agent news and draft a LinkedIn post for approval");
  const [name, setName] = useState("Manual agent + approval");
  const [msg, setMsg] = useState<string | null>(null);
  const [draftGraph, setDraftGraph] = useState<WorkflowGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showReplay, setShowReplay] = useState(true);

  const activeId = selectedId ?? workflows?.[0]?.id ?? null;
  const detail = trpc.workflow.get.useQuery(
    { workflowId: activeId! },
    { enabled: Boolean(activeId) },
  );
  const runs = trpc.workflow.listRuns.useQuery(
    { workflowId: activeId!, limit: 20 },
    { enabled: Boolean(activeId), refetchInterval: 3000 },
  );
  const activeRunId = runId ?? runs.data?.[0]?.id ?? null;
  const runDetail = trpc.workflow.getRun.useQuery(
    { runId: activeRunId! },
    { enabled: Boolean(activeRunId), refetchInterval: 2000 },
  );

  // Load server graph into local draft when workflow changes (and not dirty).
  useEffect(() => {
    if (!detail.data?.version?.graph) return;
    if (dirty && draftGraph) return;
    const g = detail.data.version.graph as WorkflowGraph;
    setDraftGraph({
      nodes: autoLayoutPositions(g.nodes ?? []),
      edges: g.edges ?? [],
    });
    setDirty(false);
  }, [detail.data?.version?.id, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const graph = draftGraph ?? EMPTY_GRAPH;

  const statusByNodeId = useMemo(() => {
    if (!showReplay || !runDetail.data?.steps) return {};
    const map: Record<string, StepStatus | string> = {};
    for (const s of runDetail.data.steps) map[s.nodeId] = s.status;
    return map;
  }, [runDetail.data?.steps, showReplay]);

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedStep = runDetail.data?.steps.find((s) => s.nodeId === selectedNodeId);

  const validate = trpc.workflow.validateGraph.useQuery(
    { graph },
    { enabled: graph.nodes.length > 0, keepPreviousData: true },
  );

  const create = trpc.workflow.create.useMutation({
    onSuccess: (r) => {
      setSelectedId(r.workflowId);
      setDirty(false);
      setDraftGraph(null);
      setMsg(`Created workflow ${r.workflowId.slice(0, 8)}…`);
      utils.workflow.list.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const saveDraft = trpc.workflow.saveDraft.useMutation({
    onSuccess: (r) => {
      setDirty(false);
      setMsg(`Saved draft v${r.version}`);
      utils.workflow.get.invalidate();
      utils.workflow.list.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const publish = trpc.workflow.publish.useMutation({
    onSuccess: () => {
      setMsg("Published");
      utils.workflow.list.invalidate();
      utils.workflow.get.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const startRun = trpc.workflow.startRun.useMutation({
    onSuccess: (r) => {
      setRunId(r.runId);
      setShowReplay(true);
      setMsg(`Run started ${r.runId.slice(0, 8)}…`);
      utils.workflow.listRuns.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const approve = trpc.workflow.approveStep.useMutation({
    onSuccess: () => {
      setMsg("Approved — downstream steps will resume");
      utils.workflow.getRun.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const cancel = trpc.workflow.cancelRun.useMutation({
    onSuccess: () => {
      setMsg("Run cancelled");
      utils.workflow.getRun.invalidate();
      utils.workflow.listRuns.invalidate();
    },
  });

  const waiting = runDetail.data?.steps.find((s) => s.status === "awaiting_approval");

  const onGraphChange = useCallback((next: WorkflowGraph) => {
    setDraftGraph(next);
    setDirty(true);
  }, []);

  const updateNode = useCallback(
    (node: WorkflowNode) => {
      setDraftGraph((g) => {
        if (!g) return g;
        return { ...g, nodes: g.nodes.map((n) => (n.id === node.id ? node : n)) };
      });
      setDirty(true);
    },
    [],
  );

  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setDraftGraph((g) => {
      if (!g) return g;
      return {
        nodes: g.nodes.filter((n) => n.id !== selectedNodeId),
        edges: g.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
      };
    });
    setSelectedNodeId(null);
    setDirty(true);
  }, [selectedNodeId]);

  const autoLayout = useCallback(() => {
    setDraftGraph((g) => {
      if (!g) return g;
      return {
        ...g,
        nodes: g.nodes.map((n, i) => ({
          ...n,
          position: { x: 80 + (i % 5) * 240, y: 80 + Math.floor(i / 5) * 140 },
        })),
      };
    });
    setDirty(true);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Automations"
        status={dirty ? "Unsaved draft" : "Visual workflow builder"}
        statusTone="violet"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate({ name })}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
            >
              + New
            </button>
            <button
              type="button"
              disabled={!activeId || !dirty || saveDraft.isPending || graph.nodes.length === 0}
              onClick={() =>
                activeId &&
                saveDraft.mutate({
                  workflowId: activeId,
                  graph,
                  changeSummary: "Canvas edit",
                })
              }
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              {saveDraft.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={!activeId || publish.isPending}
              onClick={() => activeId && publish.mutate({ workflowId: activeId })}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={!activeId || startRun.isPending || (validate.data && !validate.data.ok)}
              onClick={() => {
                if (!activeId) return;
                const run = () => startRun.mutate({ workflowId: activeId, input: { goal } });
                if (dirty) {
                  saveDraft.mutate(
                    { workflowId: activeId, graph, changeSummary: "Pre-run save" },
                    { onSuccess: () => run() },
                  );
                } else run();
              }}
              className="rounded-lg bg-[var(--color-violet)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {startRun.isPending ? "Starting…" : "Test run"}
            </button>
          </div>
        }
      />

      {msg && (
        <p className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-1.5 text-[12px] text-[var(--color-teal)]">
          {msg}{" "}
          <button type="button" className="text-[var(--color-text-muted)]" onClick={() => setMsg(null)}>
            dismiss
          </button>
        </p>
      )}

      {error && (
        <p className="px-4 py-2 text-[13px] text-[var(--color-coral)]">Failed to load: {error.message}</p>
      )}
      {isLoading && <p className="px-4 py-2 text-[13px] text-[var(--color-text-muted)]">Loading…</p>}

      {!isLoading && !error && (workflows?.length ?? 0) === 0 && (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-dashed border-[var(--color-line)] p-8 text-center">
            <p className="text-[15px] font-semibold">No workflows yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              Create a starter graph, edit it on the canvas, then test-run with live step replay.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-4 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
            />
            <button
              type="button"
              className="mt-3 rounded-xl bg-[var(--color-violet)] px-4 py-2 text-[13px] font-semibold text-white"
              onClick={() => create.mutate({ name })}
            >
              Create starter workflow
            </button>
          </div>
        </div>
      )}

      {(workflows?.length ?? 0) > 0 && (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[200px_1fr_280px]">
          {/* Left: workflows + palette */}
          <aside className="flex min-h-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]/80">
            <div className="max-h-40 space-y-1 overflow-y-auto border-b border-[var(--color-line)] p-2">
              <p className="px-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Workflows
              </p>
              {(workflows ?? []).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(w.id);
                    setRunId(null);
                    setDirty(false);
                    setDraftGraph(null);
                    setSelectedNodeId(null);
                  }}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12px] ${
                    activeId === w.id
                      ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)]"
                      : "hover:bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <span className="block truncate font-medium">{w.name}</span>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{w.status}</span>
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              <NodePalette />
            </div>
          </aside>

          {/* Center: canvas */}
          <section className="relative min-h-0 min-w-0 bg-[var(--color-ink)]">
            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={autoLayout}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              >
                Auto-layout
              </button>
              <button
                type="button"
                onClick={() => setShowReplay((v) => !v)}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  showReplay
                    ? "border-[var(--color-amber)] bg-[var(--color-amber)]/10 text-[var(--color-amber)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                Run replay {showReplay ? "on" : "off"}
              </button>
              {validate.data && !validate.data.ok && (
                <span className="rounded-md border border-[var(--color-coral)]/40 bg-[var(--color-coral)]/10 px-2 py-1 text-[11px] text-[var(--color-coral)]">
                  {validate.data.issues.filter((i) => i.severity === "error").length} validation error(s)
                </span>
              )}
            </div>
            <WorkflowCanvas
              graph={graph}
              statusByNodeId={statusByNodeId}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onGraphChange={onGraphChange}
            />
            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-2 text-[11px] backdrop-blur">
                Run input · goal
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[12px]"
                />
              </label>
              {waiting && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--color-teal)] px-3 py-2 text-[12px] font-semibold text-black"
                    onClick={() => approve.mutate({ stepRunId: waiting.id, decision: "approved" })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--color-coral)] px-3 py-2 text-[12px] text-[var(--color-coral)]"
                    onClick={() => approve.mutate({ stepRunId: waiting.id, decision: "rejected" })}
                  >
                    Reject
                  </button>
                </div>
              )}
              {activeRunId && (
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[12px]"
                  onClick={() => cancel.mutate({ runId: activeRunId })}
                >
                  Cancel run
                </button>
              )}
            </div>
          </section>

          {/* Right: inspector + runs */}
          <aside className="flex min-h-0 flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)]/80">
            <div className="min-h-0 flex-1 overflow-hidden border-b border-[var(--color-line)]">
              <NodeInspector
                node={selectedNode}
                runOutput={selectedStep?.output}
                runDecision={selectedStep?.decisionSummary}
                runError={selectedStep?.errorMessage}
                onChange={updateNode}
                onDelete={deleteNode}
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-2">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Runs</p>
              {(runs.data ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRunId(r.id);
                    setShowReplay(true);
                  }}
                  className={`mt-1 block w-full truncate rounded-lg px-2 py-1 text-left text-[11px] ${
                    activeRunId === r.id ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)]" : ""
                  }`}
                >
                  {r.status} · {r.id.slice(0, 8)}
                </button>
              ))}
              {(runs.data?.length ?? 0) === 0 && (
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">No runs yet</p>
              )}
              {runDetail.data && (
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto border-t border-[var(--color-line)] pt-2 text-[10px]">
                  {runDetail.data.events.slice(0, 12).map((e) => (
                    <li key={e.id}>
                      <span className="text-[var(--color-text-muted)]">{e.type}</span> {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(validate.data?.issues.length ?? 0) > 0 && (
              <div className="max-h-24 overflow-y-auto border-t border-[var(--color-line)] p-2 text-[10px]">
                {validate.data!.issues.map((i, idx) => (
                  <p
                    key={idx}
                    className={i.severity === "error" ? "text-[var(--color-coral)]" : "text-[var(--color-amber)]"}
                  >
                    [{i.severity}] {i.message}
                  </p>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
