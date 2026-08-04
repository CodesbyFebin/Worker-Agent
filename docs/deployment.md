# Deployment

Worker Agent.Cloud runs as **two Node processes** plus MySQL/MariaDB, Redis (BullMQ), and optional MinIO.

## Processes

| Process | Entry | Role |
|---------|--------|------|
| API | `server/_core/index.ts` (`npm run dev` / Docker `api`) | HTTP, tRPC, SSE `/events`, health, metrics |
| Worker | `server/_core/worker.ts` (`npm run worker` / Docker `worker`) | BullMQ processors only |

Do **not** run long jobs inside the API process.

## Local (Windows note)

Default Windows Redis on `:6379` is often too old for BullMQ. Use Compose Redis mapped to **`:6380`**:

```bash
REDIS_URL=redis://127.0.0.1:6380
```

## Docker Compose

```bash
docker compose up -d mysql redis minio
docker compose up -d api worker
```

Compose maps Redis host port `6380` → container `6379`. Inside the Compose network, services use `redis://redis:6379`.

MinIO: `:9000` (S3), console `:9001`. Set `S3_*` env on API/worker when using object storage.

## Health & metrics

- `GET /health` — liveness
- `GET /ready` — MariaDB + Redis ping (use for load balancer / Compose healthcheck)
- `GET /metrics` — JSON counters; `?format=prometheus` for text exposition

## Env essentials

```bash
DATABASE_URL=mysql://...
REDIS_URL=redis://127.0.0.1:6380
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
RATE_LIMIT_MAX=300
# Optional S3 / MinIO — see docs/phase9-artifacts-evidence.md
```

## Schema migrations

Prefer `drizzle/sql/phaseN_*.sql` + `scripts/apply-phaseN-sql.mjs` when `db:push` fails on FK truncate.

Phase 10: `node --env-file=.env scripts/apply-phase10-sql.mjs`

## Hardening checklist

1. Separate API and worker replicas
2. Private network for MySQL / Redis / MinIO
3. Put `/metrics` behind auth or internal network only
4. Cookie sessions (`wa_session`) require HTTPS in production (`Secure` cookie — configure at reverse proxy / env)
5. Restart API after permission seed changes

See also: [phase10-production-hardening.md](./phase10-production-hardening.md)
