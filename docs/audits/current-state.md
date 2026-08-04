# Phase 0 — Repository audit (current state)

**Date:** 2026-07-29  
**Repo:** `Cyberteckmaster/Worker-Agent` (local: `D:\Worker Agent\worker-agent-cloud`)  
**Scope:** Truthful baseline before Phase 1 hardening. No product features added in this audit.

---

## 1. Package topology

| Package | Role | Runtime |
|---|---|---|
| Root workspace | Scripts, drizzle-kit, shared tooling | npm workspaces |
| `client/` | React 19 + Vite + Tailwind 4 + tRPC React Query | `:5173` |
| `server/` | Express + tRPC + Drizzle + BullMQ workers | `:4000` |
| `drizzle/` | MySQL schema + relations | MariaDB `:3306` |
| `shared/` | Shared DTOs / contracts | imported by both |

**Root scripts before Phase 1:** `dev:server`, `dev:client`, `db:generate`, `db:push`, `local:infra` only.  
No `typecheck`, `lint`, `test`, `build`, `validate`, or `dev:worker`.

---

## 2. Frontend routes / workspaces

App uses an in-shell workspace switcher (`AppShell` / `WorkspaceId`), not React Router path segments. Notable surfaces:

- Overview, God Machine, Script Studio, Claim Ledger / Evidence
- IDEa IDE (`IdeWorkspace`)
- YouTube Autopilot / Content Ops Studio
- Automations pipeline UI (presentation / content-ops handoff — **not** a durable workflow graph engine)
- Social, Activity, Templates, Plugins, Learn, Ops (Calendar / Settings / Governance)
- Content Ops + Blogging studios

**Missing vs master prompt IA:** `/automations` graph canvas, `/ide/sessions`, org admin (`/team`, `/credentials`, `/audit-log`), MCP registry routes.

---

## 3. Backend routers (`server/routers/_app.ts`)

| Router | Purpose |
|---|---|
| `script` | Script Studio CRUD / regenerate |
| `ledger` | Claim ledger + verification |
| `godMachine` | Goal orchestration + task trees |
| `campaign` | YouTube AutoMode campaigns |
| `ide` | IDEa roster / files / costs |
| `connectors` | Connector status (real "not configured" when keys missing) |
| `settings` | LLM prefs / provider settings |
| `pipeline` | Content Ops stage handoff |

Auth: `protectedProcedure` requires `ctx.userId` from `x-user-id` header stand-in (`server/_core/context.ts`). **Not** session-based org tenancy.

---

## 4. Database (Drizzle / MySQL)

Tables present (high level):

- `users`
- `scripts`, `script_sections`, `generated_metadata`
- `claim_ledger`
- `agent_tasks`, `agent_events`, `agent_worktrees`
- `content_campaigns`
- `content_ops_pipelines`

**Missing vs master prompt:** organizations, memberships, RBAC, workflow_definitions/versions/runs, agent_definitions/versions, tool_invocations, approval_requests, credential vault, artifacts store, idempotency_records, audit_logs, etc.

Ownership today is mostly `userId`, not `organizationId`.

---

## 5. Queues / workers

BullMQ queues (`server/_core/queue.ts`):

- `god-machine-chain`
- `campaign-day`
- `scheduled-publish`

**Pre-Phase-1 process model:** workers registered inside the same Node process as the API (`server/_core/index.ts`). Comment in code already called this out as a production limit.

Redis: local Windows uses port **6380** (Redis 5 portable); Docker Compose maps Redis 7 to host `6380`.

---

## 6. Agents

Implemented roles under `server/agents/`: planner, researcher, writer, reviewer, coder, videoGenerator, plus dispatch in `server/agents/index.ts`.  
LLM routing via `server/services/llm/*` (OpenRouter, NVIDIA NIM, Ollama, Groq, Gemini, Pollinations, Anthropic).

---

## 7. Tests / CI / Docker (pre-Phase-1)

| Capability | Status before Phase 1 |
|---|---|
| Unit / integration tests | **None** |
| ESLint | **None** |
| CI workflow | **None** |
| Docker Compose | **None** |
| `/health` | Present — `{ ok: true }` only (no DB/Redis) |
| `/ready` | **Missing** |

---

## 8. Build / typecheck failures recorded (pre-fix)

Commands run from repo root:

```text
npx tsc --noEmit -p client/tsconfig.json  → exit 2
npx tsc --noEmit -p server/tsconfig.json  → exit 2
```

Failures observed:

1. `import.meta.env` missing Vite client types (`App.tsx`, `IdeWorkspace.tsx`)
2. `ContentPipelineBar` dead compare `stage === "done"` after narrowing
3. `IdeWorkspace` compare `status === "idle"` vs inferred task-status union
4. BullMQ `queue.add(name: string)` generic mismatch in `enqueue`
5. `publishEvent` eventType union missing `pipeline_handoff` / `pipeline_advance`

No ESLint/test suite existed to fail yet.

---

## 9. Local runtime (this machine)

| Service | URL / port | Notes |
|---|---|---|
| Vite client | http://localhost:5173 | Working when `dev:client` up |
| API | http://localhost:4000 | Working when `dev:server` up |
| MariaDB | 3306 | `npm run local:infra` |
| Redis BullMQ | 6380 | Redis 5 compromise documented in README |

---

## 10. Security / tenancy gaps (known, deferred)

- Production must not rely on `x-user-id: local-dev-user`
- SSE `/events` unauthenticated
- No org scope on queries
- No credential vault / envelope encryption
- Workers previously co-located with API (restart blast radius)

These are Phase 2+ items. Phase 1 only establishes a stable, tested baseline.

---

## 11. Phase 1 target (this pass)

- Fix type errors so `typecheck` passes
- Root scripts: `dev`, `dev:web`, `dev:api`, `dev:worker`, `typecheck`, `lint`, `test`, `build`, `validate`
- Split API vs worker processes
- `/health` + `/ready` (DB + Redis)
- Vitest + ESLint + GitHub Actions CI
- Docker Compose (MariaDB, Redis, API, worker, client, MinIO, optional Mailpit)
- Baseline docs under `docs/`

---

## 12. Phase 1 verification (executed)

| Command | Result |
|---|---|
| `npm run typecheck` | **pass** (exit 0) |
| `npm run lint` | **pass** (exit 0; warnings only) |
| `npm run test` | **pass** (4 tests) |
| `npm run build` | **pass** (client Vite + server tsc) |
| `GET /ready` | `database: up`, `redis: up` |
| Client | http://localhost:5173 → HTTP 200 |
