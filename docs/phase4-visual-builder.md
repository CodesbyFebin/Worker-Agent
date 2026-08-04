# Phase 4 — Visual workflow builder

## What landed

- React Flow canvas on **Automations** (pan, zoom, mini-map, connect, drag-drop)
- Node library palette (all Phase 3 executable types)
- Inspector: name, prompts, conditions, delay, error strategy, max attempts
- Save draft / publish / test run (auto-saves dirty graph before run)
- Live validation via `workflow.validateGraph`
- **Run replay** overlays step status colors on canvas nodes
- Click a node during/after a run to see execution output in the inspector
- Keyboard: Delete removes selected node; Ctrl/Cmd +/- / 0 zoom

## Files

- `client/src/features/automations/canvas/WorkflowCanvas.tsx`
- `client/src/features/automations/canvas/WorkflowNodeCard.tsx`
- `client/src/features/automations/canvas/NodeInspector.tsx`
- `client/src/features/automations/workflowGraph.ts`
- `client/src/features/automations/WorkflowsRuntimeWorkspace.tsx`
- Node `position` field on server graph schema

## How to try

1. Dev login → **Automations**
2. Create / select a workflow
3. Drag nodes from the library, connect handles
4. Save draft → Test run → watch replay colors → Approve if waiting

## Remaining limits

- Undo/redo history stack not yet implemented (reload restores last saved version)
- Copy/paste multi-select clone not yet implemented
- NL workflow generator = later phase
- Full node-type catalog from the master prompt still partial
