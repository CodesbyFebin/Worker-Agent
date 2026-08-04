# Phase 5 — Agent runtime

## What landed

- Agent definitions with versioned prompts, model policies, tool policies, and capabilities
- Durable `agent_executions` usage records (tokens, provider/model, cost, workflow linkage)
- Evaluation suite: create cases, run against current version, store pass/fail + score
- Workflow `agent.task` resolves `agentDefinitionId` or active agent by `agentRole`; otherwise ephemeral run still recorded
- **Agents** workspace in AppShell (list / create / run / evaluations / usage)
- Permission `agent:write` (plus existing `agent:read` / `agent:dispatch`)

## Files

- `drizzle/schema.ts` — Phase 5 tables
- `drizzle/sql/phase5_agent_runtime.sql`
- `server/services/agent/runtime.ts`
- `server/routers/agents.router.ts`
- `server/services/workflow/executors.ts` — wired to agent runtime
- `client/src/features/agents/AgentsWorkspace.tsx`
- `docs/phase5-agent-runtime.md`

## How to try

1. Apply SQL: `drizzle/sql/phase5_agent_runtime.sql`
2. Dev login → **Agents** → New agent → Run
3. Add an evaluation with expect-contains needles → Run evaluation
4. In **Automations**, set an `agent.task` node's Agent definition ID (or role) and test-run

## Remaining limits

- Memory / approval / retry policies are not separate tables yet (retry still via workflow node error strategy)
- Tool policies store allow-lists only — Tool Gateway (Phase 7) executes tools
- No NL agent generator; no multi-agent swarm orchestration UI
- Eval scoring is substring / cost based, not LLM-as-judge
