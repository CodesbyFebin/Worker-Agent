# Phase 10 — Production hardening

## What landed

- **API vs worker** already split (`server/_core/index.ts` vs `worker.ts`); worker sets `WA_PROCESS_ROLE=worker`
- **Dead-letter queue** — exhausted BullMQ jobs persist to `dead_letter_jobs` (redacted payload)
- **Recovery UI** — nav **Recovery**: list / retry / discard (`ops:recover`)
- **Rate limiting** — in-process fixed window on `/trpc` and `/events` (`RATE_LIMIT_MAX`, default 300/min/IP)
- **Secret redaction** — logs, audit payloads, DLQ error/payload, tRPC `onError`
- **Sandbox guards** — path segment blocklist + dangerous command patterns (still allowlist-first; not a VM)
- **Observability** — `GET /metrics` (JSON) or `?format=prometheus` / `Accept: text/plain`
- Health remains `/health` (liveness) and `/ready` (DB + Redis)

## Apply schema

```bash
node --env-file=.env scripts/apply-phase10-sql.mjs
```

Restart API so bootstrap seeds `ops:recover`.

## Ops

| Surface | Notes |
|---------|--------|
| Recovery workspace | Open DLQ jobs; Retry re-enqueues; Discard closes |
| `ops.metrics` | Process counters + BullMQ job counts |
| `/metrics` | Unauthenticated process counters (do not expose publicly without a reverse proxy) |

## Remaining limits

- Rate limiter is **per-process memory** — use Redis-backed limits for multi-replica API
- DLQ payloads are **redacted** — retry may be insufficient if a job required secrets in the body (current jobs use IDs only)
- Sandbox is **allowlist + path guards**, not container isolation
