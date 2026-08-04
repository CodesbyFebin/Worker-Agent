# Phase 3 — Durable workflow runtime

## What landed

- Schema: `workflow_definitions`, `workflow_versions`, `workflow_runs`, `workflow_step_runs`, `workflow_run_events`, `idempotency_records`
- Graph compiler (`compileWorkflowGraph`) with cycle detection + trigger validation
- Durable step queue `workflow-step` — **one BullMQ job per step**
- Executors: `trigger.manual`, `logic.transform`, `logic.condition`, `logic.delay`, `logic.merge`, `human.approval`, `agent.task`, `output.return`, `output.notify`
- Error strategies: stop / retry / retry_with_backoff / skip / continue
- Human approval pauses the run; approve resumes downstream
- Org-scoped tRPC `workflow.*` APIs + Automations UI

## SQL

`drizzle/sql/phase3_workflow_runtime.sql`

## How to try

1. Ensure `npm run dev:api` + `npm run dev:worker` (worker must register `workflow-step`)
2. Dev login at http://localhost:5173
3. Open **Automations**
4. Create starter workflow → Test run → Approve when waiting

## Remaining limits

- Visual canvas / NL generator = Phase 4+
- Not all master-prompt node types implemented (HTTP/MCP/browser/shell later)
- `output.notify` records “Not configured” — no fake delivery
- Loops with max-iteration caps not yet first-class (use graph + condition for now)
