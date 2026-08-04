# Phase 8 — Approvals and governance

## What landed

- **Unified approval engine** with SHA-256 **payload binding** (`approval_requests`)
- **Governance policies** persisted in MySQL (replaces localStorage toggles)
- **Org budgets** (daily/weekly/monthly/lifetime) with soft/hard enforcement
- **Security events** for tool denials, budget overages, approval rejects / binding mismatches
- **Audit log** surfaced in Governance UI
- Workflow `human.approval` auto-enqueues into the unified queue
- Agent runs respect hard budgets via `assertBudgetAllows`
- **Approvals** + **Governance** nav both open the real workspace

## Permissions

- `approval:read` / `approval:decide`
- `governance:write` (owner/admin) — policies + budgets
- `audit:read` — security events + audit log

## Files

- `drizzle/schema.ts` + `drizzle/sql/phase8_approvals_governance.sql`
- `server/services/governance/engine.ts`
- `server/routers/governance.router.ts`
- `client/src/features/ops/GovernanceWorkspace.tsx`
- Hooks in workflow runtime, tool gateway, agent runtime

## How to try

1. `node --env-file=.env scripts/apply-phase8-sql.mjs`
2. Restart API (permission re-seed)
3. **Governance** → save policy / set budget
4. Run Automations workflow with human.approval → **Approvals** → Sync queue → Approve/Reject
5. Deny a tool or exceed budget → **Security** tab

## Remaining limits

- Campaign publisher `approveDay` still has its own path (also syncable via Sync queue for `agent_task`)
- Governance rule toggles are stored and displayed; claim-pipeline code does not yet read every flag on every stage
- Budget uses recorded `cost_usd` columns (0 if pricing env unset)
- No multi-approver / quorum yet
