# Development baseline

Phase 0 audit: [`docs/audits/current-state.md`](./audits/current-state.md)

## Scripts

| Command | Purpose |
|---|---|
| `npm run local:infra` | Windows: start local MariaDB + Redis 6380 |
| `npm run dev` | API + worker + Vite client (concurrent) |
| `npm run dev:api` | Express/tRPC API only (`:4000`) |
| `npm run dev:worker` | BullMQ workers only |
| `npm run dev:web` | Vite client (`:5173`) |
| `npm run typecheck` | Client + server `tsc --noEmit` |
| `npm run lint` | ESLint flat config |
| `npm run test` | Vitest |
| `npm run build` | Client Vite build + server `tsc` |
| `npm run validate` | typecheck → lint → test → build |
| `npm run db:push` | Push Drizzle schema to MySQL |

## Health endpoints

| Endpoint | Meaning |
|---|---|
| `GET /health` | Process liveness (`ok: true`) |
| `GET /ready` | Readiness — probes MySQL (`SELECT 1`) and Redis `PING`. Returns **200** when both up, **503** otherwise. |

Example ready payload:

```json
{
  "ok": true,
  "service": "api",
  "status": "ready",
  "database": "up",
  "redis": "up",
  "errors": [],
  "redisUrlHost": "127.0.0.1:6380",
  "timestamp": "…"
}
```

## Docker Compose

```bash
docker compose up --build
```

Exposes:

- Client: http://localhost:5173
- API: http://localhost:4000
- MinIO console: http://localhost:9001
- Mailpit UI (profile `mail`): http://localhost:8025

Compose overrides `DATABASE_URL` / `REDIS_URL` for container networking. Copy `.env.example` → `.env` and fill provider keys as needed.

## Process separation

- **API** (`server/_core/index.ts`) serves HTTP/tRPC/SSE and enqueues jobs. It does **not** register BullMQ workers.
- **Worker** (`server/_core/worker.ts`) registers God Machine, campaign-day, and scheduled-publish processors.

Local `npm run dev` starts both. Do not rely on the API process alone for durable job execution.

## Baseline gate

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

All four must pass before Phase 2 (auth/tenancy) or workflow-engine work begins.
