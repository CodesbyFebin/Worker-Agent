# Architecture

Worker Agent.Cloud is a production-grade content automation platform with a layered architecture.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React)                               │
│  ┌───────────────┬───────────────┬───────────────┬───────────────┐   │
│  │ Script Studio │ Claim Ledger  │ God Machine   │ YouTube       │   │
│  │               │               │               │ AutoMode      │   │
│  └───────────────┴───────────────┴───────────────┴───────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ tRPC
┌───────────────────────────────▼─────────────────────────────────────┐
│                          SERVER (Express)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │   tRPC       │  │   REST v1    │  │   SSE Events │  │ Webhooks│ │
│  │   Router     │  │   API        │  │   Stream     │  │    │    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
│         │               │                  │              │     │
│         ▼               │                  │              │     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    GOD MACHINE ENGINE                        │   │
│  │  Orchestrator ▶ Planner ▶ Researcher ▶ Writer ▶ Reviewer   │   │
│  │  ▶ Coder ▶ QA ▶ Publisher ▶ Video Gen ▶ Video Edit ▶ Voice   │   │
│  │  ▶ Caption ▶ SEO                                             │   │
│  └───────────────────────┬──────────────────────────────────────┘   │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    WORKFLOW ENGINE                           │   │
│  │  Workflow Definitions ▶ Workflow Runs ▶ Step Runs ▶ Agents   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│              ┌───────────┴───────────┐                              │
│              ▼                       ▼                              │
│  ┌──────────────────┐    ┌──────────────────┐                        │
│  │   BULLMQ QUEUE   │    │   TOOL GATEWAY   │                        │
│  │                  │    │                  │                        │
│  │  god-machine     │    │  Builtin Tools   │                        │
│  │  campaign-day    │    │  MCP Tools       │                        │
│  │  scheduled-pub   │    │  External APIs   │                        │
│  └──────────────────┘    └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (MySQL)                                │
│  Users, Sessions, Organizations, Scripts, Claims, Tasks, Workflows,     │
│  Tools, MCP Servers, Artifacts, Security Events...                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### Client (React 19 + Vite 5)

- **Port**: 5173
- **Features**: 20+ workspaces, AppShell navigation, Agent Rail, real-time updates
- **Build**: Vite with Tailwind CSS 4

### Server (Express 4 + tRPC 10)

- **Port**: 4000
- **Routes**:
  - `/trpc` — tRPC router (18 routers)
  - `/api/v1` — REST v1 API
  - `/events` — Authenticated SSE stream
  - `/health` — Liveness probe
  - `/ready` — Readiness probe (DB + Redis check)
  - `/metrics` — Prometheus metrics
  - `/webhooks` — Webhook endpoint

### Worker (BullMQ)

- Runs in separate process (`worker.ts`)
- **Queues**: god-machine-chain, campaign-day, scheduled-publish
- **Retry**: 3 attempts with exponential backoff
- **DLQ**: Dead-letter persistence with redacted payloads

### Database (MySQL/MariaDB)

- **ORM**: Drizzle ORM
- **Schema**: 25+ tables across phases
- **Migrations**: `drizzle/sql/` directory

## Data Flow Examples

### Agent Execution Flow

1. User dispatches a goal via God Machine
2. Planner agent decomposes into subtasks
3. Tasks enqueued to BullMQ
4. Worker processes each task
5. Results stored and streamed via SSE

### Content Publishing Flow

1. Campaign created with daily schedule
2. Research agent gathers topics
3. Writer generates script + metadata
4. Media agents generate video/audio
5. Reviewer approves
6. Publisher uploads via platform API

### MCP Tool Invocation

1. MCP server registered via UI
2. Tools auto-discovered via `tools/list`
3. Tool added to organization allowlist
4. Agent invokes tool via Tool Gateway
5. Invocation logged with cost tracking

## Security Layers

1. **Authentication**: Session-based with HTTP-only cookies
2. **Authorization**: RBAC with 4 roles (owner/admin/member/viewer)
3. **Tenancy**: Organization-scoped all domain queries
4. **Rate Limiting**: In-process (production: Redis-backed)
5. **Sandbox**: Path guards + command allowlist for code agents
6. **Audit**: All sensitive operations logged

## Scalability Notes

- API and Worker processes are separate
- Redis handles BullMQ persistence
- Database indexes on organization isolation
- SSE events filtered by organization
- Rate limiter uses in-process memory (production: Redis recommended)
