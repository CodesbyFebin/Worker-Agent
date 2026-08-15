# ADR-001: Runtime Architecture

## Status

Accepted (2025-01-10)

## Context

Worker Agent needed a runtime architecture that could support:

1. Real-time agent execution with streaming events
2. Background job processing for long-running tasks
3. Multi-tenant organization isolation
4. Scalable and observable infrastructure

The team considered:

- **Next.js monorepo**: Rejected due to complexity and vendor lock-in
- **Supabase**: Rejected because the project already uses MariaDB + Redis
- **Express monolith**: Insufficient for real-time SSE + worker separation
- **Separate API + Worker processes**: Selected

## Decision

We adopt a **dual-service architecture**:

```
Client (Vite/React) ←→ API (Express/Node) ←→ Database (MariaDB)
                               │
                          Worker (BullMQ/Redis)
```

### API Service

- Serves tRPC API at `/trpc/*`
- Serves REST API at `/api/v1/*`
- Handles SSE streaming at `/events`
- Runs on port `:4000`
- Stateless (can be horizontally scaled)

### Worker Service

- Processes BullMQ jobs from Redis
- Handles agent execution, research, publishing
- Separate from API for long-running job isolation
- Shares same codebase via `npm --prefix server run dev:worker`

### Why not Next.js?

1. The project already has a mature Vite + Express setup
2. Next.js SSR adds complexity without value for this workspace app
3. tRPC already provides type safety across client and server
4. Vite dev server is faster for iterative development

## Consequences

- Can scale API and Worker independently
- SSE events are cleanly separated from job processing
- Requires Redis for both event streaming and job queue
- Developers must run 3 processes locally (API, Worker, Client)