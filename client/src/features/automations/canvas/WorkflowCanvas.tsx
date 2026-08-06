import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  NODE_LIBRARY,
  autoLayoutPositions,
  newNodeId,
  type StepStatus,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
} from "../workflowGraph";
import { WorkflowNodeCard, type WorkflowRfData } from "./WorkflowNodeCard";

const nodeTypes = { workflow: WorkflowNodeCard };

function toRfNodes(
  graph: WorkflowGraph,
  statusByNodeId: Record<string, StepStatus | string | undefined>,
): Node[] {
  const laid = autoLayoutPositions(graph.nodes);
  return laid.map((n) => ({
    id: n.id,
    type: "workflow",
    position: n.position ?? { x: 0, y: 0 },
    data: {
      label: n.name,
      nodeType: n.type,
      status: statusByNodeId[n.id],
      requiresApproval: n.requiresApproval || n.type === "human.approval",
    } satisfies WorkflowRfData,
  }));
}

function toRfEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
    style: { stroke: e.label === "false" ? "var(--color-coral)" : "var(--color-teal)" },
    labelStyle: { fill: "var(--color-text-muted)", fontSize: 10 },
  }));
}

function fromRf(
  nodes: Node[],
  edges: Edge[],
  prev: WorkflowGraph,
): WorkflowGraph {
  const prevById = new Map(prev.nodes.map((n) => [n.id, n]));
  return {
    nodes: nodes.map((n) => {
      const prevN = prevById.get(n.id);
      const data = n.data as WorkflowRfData;
      return {
        id: n.id,
        type: (prevN?.type ?? data.nodeType) as WorkflowNodeType,
        name: prevN?.name ?? data.label,
        config: prevN?.config ?? {},
        position: { x: n.position.x, y: n.position.y },
        requiresApproval: prevN?.requiresApproval,
        errorStrategy: prevN?.errorStrategy ?? "stop_workflow",
        maxAttempts: prevN?.maxAttempts ?? 3,
      } satisfies WorkflowNode;
    }),
    edges: edges.map(
      (e) =>
        ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : undefined,
        }) satisfies WorkflowEdge,
    ),
  };
}

type Props = {
  graph: WorkflowGraph;
  statusByNodeId?: Record<string, StepStatus | string | undefined>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  readOnly?: boolean;
};

function CanvasInner({
  graph,
  statusByNodeId = {},
  selectedNodeId,
  onSelectNode,
  onGraphChange,
  readOnly,
}: Props) {
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(toRfNodes(graph, statusByNodeId));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(graph));

  // Sync from parent when graph identity / run statuses change.
  const graphKey = useMemo(
    () =>
      JSON.stringify({
        n: graph.nodes.map((x) => [x.id, x.position, x.name, x.type]),
        e: graph.edges,
        s: statusByNodeId,
      }),
    [graph, statusByNodeId],
  );

  const lastKey = useRef("");
  useEffect(() => {
    if (lastKey.current === graphKey) return;
    lastKey.current = graphKey;
    setNodes(toRfNodes(graph, statusByNodeId));
    setEdges(toRfEdges(graph));
  }, [graphKey, graph, statusByNodeId, setNodes, setEdges]);

  const emit = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onGraphChange(fromRf(nextNodes, nextEdges, graphRef.current));
    },
    [onGraphChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            id: `e_${connection.source}_${connection.target}_${Date.now().toString(36)}`,
            style: { stroke: "var(--color-teal)" },
          },
          eds,
        );
        emit(nodes, next);
        return next;
      });
    },
    [emit, nodes, readOnly, setEdges],
  );

  const onSelectionChange = useCallback(
    ({ nodes: sel }: OnSelectionChangeParams) => {
      onSelectNode(sel[0]?.id ?? null);
    },
    [onSelectNode],
  );

  const onNodeDragStop = useCallback(() => {
    emit(nodes, edges);
  }, [emit, nodes, edges]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (readOnly) return;
      event.preventDefault();
      const type = event.dataTransfer.getData("application/workflow-node") as WorkflowNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const lib = NODE_LIBRARY.find((n) => n.type === type);
      const id = newNodeId(type);
      const wfNode: WorkflowNode = {
        id,
        type,
        name: lib?.label ?? type,
        config: { ...(lib?.defaultConfig ?? {}) },
        position,
        requiresApproval: type === "human.approval",
        errorStrategy: type === "agent.task" ? "retry_with_backoff" : "stop_workflow",
        maxAttempts: type === "agent.task" ? 3 : 1,
      };
      const nextGraph: WorkflowGraph = {
        nodes: [...graphRef.current.nodes, wfNode],
        edges: graphRef.current.edges,
      };
      onGraphChange(nextGraph);
      onSelectNode(id);
    },
    [onGraphChange, onSelectNode, readOnly, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (readOnly) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId) {
        const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
        const nextEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
        setNodes(nextNodes);
        setEdges(nextEdges);
        emit(nextNodes, nextEdges);
        onSelectNode(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "=") {
        event.preventDefault();
        zoomIn();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        zoomOut();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "0") {
        event.preventDefault();
        void fitView({ padding: 0.2 });
      }
    },
    [
      emit,
      edges,
      fitView,
      nodes,
      onSelectNode,
      readOnly,
      selectedNodeId,
      setEdges,
      setNodes,
      zoomIn,
      zoomOut,
    ],
  );

  // Highlight selection
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    );
  }, [selectedNodeId, setNodes]);

  return (
    <div className="h-full w-full" tabIndex={0} onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        multiSelectionKeyCode={readOnly ? null : "Shift"}
      >
        <Background color="#2a2040" gap={20} />
        <Controls className="!border-[var(--color-line)] !bg-[var(--color-surface)] !shadow-none" />
        <MiniMap
          className="!border-[var(--color-line)] !bg-[var(--color-surface)]"
          nodeColor={() => "#ff2bd6"}
          maskColor="rgba(5,3,12,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export function NodePalette({ disabled }: { disabled?: boolean }) {
  return (
    <div className="space-y-3 overflow-y-auto p-3">
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Node library</p>
      {(["trigger", "logic", "agent", "human", "youtube", "output"] as const).map((cat) => (
        <div key={cat}>
          <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--color-teal)]">{cat}</p>
          <div className="space-y-1">
            {NODE_LIBRARY.filter((n) => n.category === cat).map((n) => (
              <div
                key={n.type}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/workflow-node", n.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className={`cursor-grab rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 active:cursor-grabbing ${
                  disabled ? "opacity-40" : "hover:border-[var(--color-violet)]"
                }`}
                title={n.blurb}
              >
                <p className="text-[11px] font-medium">{n.label}</p>
                <p className="truncate text-[10px] text-[var(--color-text-muted)]">{n.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
