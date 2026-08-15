# Architecture Overview

Worker Agent uses a dual-layer architecture: a public marketing experience and an authenticated operational workspace.

## High-Level Diagram

```
workeragent.cloud
     │
┌────▼────┐      ┌────────│──────┐
│ PUBLIC  │      │ MISSION CONTROL │
│ Vite SSG│─────▶│ React + tRPC   │
└─────────┘      └──────┬─────────┘
                        │ tRPC / SSE
            ┌───────────▼──────────┐
            │        API           │
            │  Node / TypeScript   │
            └──────┬───────┬───────┘
                   │       │
            ┌──────▼──┐ ┌─▼──────┐
            │MariaDB  │ │ Redis  │
            │(62 tab) │ │BullMQ  │
            └─────────┘ └────┬────┘
                             │
                    ┌────────▼────────┐
                    │    Worker        │
                    │  Agent Jobs      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │  AI / Tools  │ Research     │
              └──────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 19** — UI library
- **Vite** — Build tooling
- **tRPC** — Type-safe API communication
- **Tailwind CSS** — Styling system

### Backend
- **Node.js / Express** — API server
- **tRPC** — Type-safe API layer
- **REST API v1** — REST endpoints
- **SSE** — Real-time event streaming
- **BullMQ** — Distributed job queue
- **MariaDB** — Primary database (62 tables)
- **Redis** — Session store, event streaming, queue backend

### Infrastructure
- **Docker** — Containerization
- **Nginx** — Reverse proxy (production)
- **systemd** — Service management (production)

## Security Model

- Argon2id password hashing
- HttpOnly + Secure + SameSite session cookies
- Organization-scoped data access
- Rate limiting on authentication
- Audit logging for security events
- Secret scanning in CI