# Current State — Worker Agent.Cloud (Updated 2026-08-15)

## Repository Overview

| Attribute | Value |
|---|---|
| **Name** | Worker Agent.Cloud |
| **URL** | https://github.com/Cyberteckmaster/Worker-Agent |
| **Type** | AI Content Automation Platform |
| **MCP Role** | Client (connects to external MCP servers) |
| **Version** | 2.0.0 |
| **Node.js** | >=20.0.0 |

## Architecture

### System Layers

```
Client (React 19 + Vite 5) ▶ tRPC Client ▶ API (Express 4 + tRPC 10)
                                                              │
            ┌─────────────────────────────────────────────────┼─────────────────────────┐
            │                                                 │                         │
            ▼                                                 ▼                         ▼
    ┌──────────────┐                                ┌──────────────┐          ┌──────────────┐
    │  20 Workspaces│                                │  tRPC Routers│          │  REST v1     │
    │  AppShell    │                                │  18 routers  │          │  Endpoints   │
    │  Agent Rail  │                                │              │          │              │
    └──────────────┘                                └──────┬───────┘          └──────────────┘
                                                          │
            ┌─────────────────────────────────────────────┼─────────────────────────────┐
            │                                             │                             │
            ▼                                             ▼                             ▼
    ┌──────────────────┐                        ┌──────────────────┐          ┌──────────────────┐
    │  GOD MACHINE     │                        │  WORKFLOW ENGINE │          │  TOOL GATEWAY    │
    │  12 Agents       │                        │  WorkflowDefs    │          │  Builtin Tools   │
    │  Orchestrator    │                        │  WorkflowRuns    │          │  MCP Tools       │
    └────────┬─────────┘                        └────────┬─────────┘          └────────┬─────────┘
             │                                           │                             │
             │                                ┌──────────┴──────────┐                  │
             │                                │                     │                  │
             │                                ▼                     ▼                  │
             │                          ┌──────────┐          ┌──────────┐              │
             │                          │ McpClient│          │Services  │              │
             │                          │ 121 lines│          │ 7 platfs │              │
             │                          └──────────┘          └──────────┘              │
             │                                                                             │
             │                                         ┌─────────────────┐                │
             │                                         │ BULLMQ + REDIS  │                │
             │                                         └────────┬────────┘                │
             │                                              │                             │
             └──────────────────────────────────────────────┼─────────────────────────────┘
                                                              │
                                                     ┌────────▼────────┐
                                                     │ DATABASE (MySQL)│
                                                     │ 25+ tables      │
                                                     │ DRIZZLE ORM     │
                                                     └─────────────────┘
```

## Package Topology

| Package | Version | Purpose |
|---|---|---|
| Root (`worker-agent-cloud`) | 2.0.0 | Workspaces, drizzle-kit, vitest |
| `client/` | 0.1.0 | React 19 + Vite + Tailwind 4 + tRPC |
| `server/` | 0.1.0 | Express 4 + tRPC 10 + Drizzle + BullMQ |

## API Surface

### tRPC Routers (18 total)

| Router | Procedures |
|---|---|
| `auth` | devLogin, logout, me, listOrganizations, switchOrganization |
| `script` | regenerateSection, generateMetadata |
| `ledger` | listByScript, extractAndLog, setStatus, verifyClaim |
| `godMachine` | dispatchGoal, runSubtask, getTaskTree, listRootTasks, listActive |
| `campaign` | start, list, getDays, approveDay |
| `ide` | Multiple IDE/workspace procedures |
| `connectors` | Connector status |
| `settings` | LLM prefs, provider settings |
| `pipeline` | Content Ops stage handoff |
| `workflow` | Workflow CRUD, runs |
| `knowledge` | Search, semantic, embeddings |
| `agents` | Agent definitions, executions |
| `tools` | Tool discovery, invocation, MCP registration |
| `governance` | Policies, approvals |
| `artifacts` | Artifact CRUD, uploads |
| `ops` | Operations, recovery, metrics |
| `youtubeStudio` | YouTube Analytics/Studio |
| `chat` | Agent chat sessions |

### REST v1 Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/workflows` | GET, POST | Workflow management |
| `/api/v1/goals` | POST | Dispatch new goal |
| `/api/v1/campaigns` | GET, POST | Campaign creation |
| `/api/v1/youtube/channels` | GET | List YouTube channels |
| `/api/v1/knowledge/search` | GET | Knowledge search |
| `/api/v1/knowledge/semantic` | GET | Semantic similarity |

## MCP Client Capabilities

| Operation | Status | Notes |
|---|---|---|
| `initialize` | ✅ | Protocol v2024-11-05 |
| `tools/list` | ✅ | Full discovery |
| `tools/call` | ✅ | With validation |
| `resources/list` | ✅ | Resource discovery |
| `resources/read` | ⚠️ | Partial support |
| `prompts/list` | ⚠️ | Discovered but not exposed |
| `prompts/get` | ❌ | Not implemented |

Transport: HTTP with SSE fallback
Location: `server/services/tools/mcpClient.ts` (121 lines)

## Security Controls

| Control | Implementation |
|---|---|
| Authentication | Session-based + HTTP-only cookies |
| Authorization | 4-role RBAC (owner/admin/member/viewer) |
| Rate Limiting | In-process (300 req/60s/IP) |
| CORS | Restricted origins |
| CSP | Enforced in vercel.json |
| HSTS | Enabled in vercel.json |
| Secret Redaction | Pino redaction middleware |
| SQL | Prepared statements via Drizzle |

## Database Schema (25+ tables)

### Core Tables
- `users`, `sessions`, `organizations`, `organizationMembers`, `roles`
- `scripts`, `script_sections`, `generated_metadata`
- `claim_ledger`

### Workflow Engine
- `agent_tasks`, `agent_events`, `agent_worktrees`
- `content_campaigns`, `pipeline_run_steps`
- `workflow_definitions`, `workflow_versions`, `workflow_runs`, `workflow_step_runs`

### MCP Integration
- `mcp_servers`, `tool_definitions`, `tool_invocations`
- `credential_refs`, `tool_gateway_policies`

### Publishing
- `youtube_channels`, `youtube_videos`, `youtube_trends`
- `artifacts`, `artifact_versions`

### Governance
- `approval_requests`, `governance_policies`
- `organization_budgets`, `security_events`

## Tests

14 test files covering:
- `agent.runtime.test.ts` — Agent execution
- `artifacts.evidence.test.ts` — Artifact handling
- `auth.tenancy.test.ts` — Auth and tenancy
- `governance.advanced.test.ts` — Governance policies
- `governance.engine.test.ts` — Governance engine
- `health.contract.test.ts` — Health endpoint contract
- `ide.allowlist.test.ts` — IDE security
- `knowledge.service.test.ts` — Knowledge service
- `phase10.hardening.test.ts` — Production hardening
- `pipeline.nextStage.test.ts` — Pipeline progression
- `restApi.test.ts` — REST API
- `tools.gateway.test.ts` — Tool gateway
- `workflow.compiler.test.ts` — Workflow compilation
- `youtube.studio.test.ts` — YouTube integration

## Health Endpoints

| Endpoint | Response |
|---|---|
| `GET /health` | `{ ok: true }` (liveness) |
| `GET /ready` | `{ ok: true, database: "up", redis: "up" }` (readiness) |
| `GET /metrics` | Prometheus metrics |

## Observability

- **Logging**: Pino with JSON and redaction
- **Metrics**: Prometheus counters and summaries
- **Tracing**: OpenTelemetry integration
- **Request IDs**: `x-request-id` header
- **Error Categorization**: tRPC error codes

## CI/CD Status

GitHub Actions workflow runs on push to main/master:
```
checkout → node setup → install → audit → typecheck → lint → test → build
```

## Deployment

### Docker

```bash
docker compose up --build
```

Ports:
- Client: 5173
- API: 4000
- MinIO Console: 9001

### Vercel

Deploy via Vercel CLI or GitHub integration.
Config: `vercel.json`

