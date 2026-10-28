# Mission Control production hardening — release gates

Status: **RED / HOLD** until every gate below has attached evidence.

Landing source on `main` is not production verification.

## Gate A — source / compile

```bash
npm --prefix server run typecheck
npm --prefix server run build
```

Pass: both commands exit 0. Do not waive unrelated repository TypeScript failures; repair the baseline first.

## Gate B — scratch database migrations

Apply to a disposable MySQL schema in order:

```bash
mysql scratch < drizzle/sql/0041_mission_control_hardening.sql
mysql scratch < drizzle/sql/0042_mc_run_linkage.sql
```

Verify at minimum:

- `agent_tasks.run_id`
- `mission_control_approvals.run_id`
- `workflow_runs.trace_id`
- `mission_control_event_log.stream_position` is monotonic `BIGINT UNSIGNED`
- outbox claim indexes exist

Do not apply these migrations to an unrelated Supabase/Postgres project.

## Gate C — Mission Control integration suite

Requires isolated MySQL + Redis fixtures:

```bash
MC_INTEGRATION_TESTS=1 npx vitest run server/tests/mc
```

Pass criteria:

- deterministic governance gate identity
- stale approved gate never satisfies current state
- concurrent approval resolution has exactly one winner
- stale approval supersession commits and creates one fresh pending gate
- missing run is an integrity failure
- concurrent outbox claims are disjoint
- dead-worker claims are reclaimed
- duplicate durable event ids are rejected/idempotently handled
- SSE reconnect is contiguous and deduplicated during handshake traffic
- idle SSE receives heartbeat
- cross-organization approval access is forbidden
- cross-organization live stream events are not exposed

A skipped integration suite is **not** a pass.

## Gate D — authenticated live API acceptance

Against the deployed API with a valid session:

```text
GET /events?after=abc -> 400
GET /events?after=-1  -> 400
```

Then prove reconnect from a real `Last-Event-ID` returns every later durable event once, in stream-position order.

Verify an authenticated user cannot switch to an organization where they lack membership.

## Gate E — horizontal worker acceptance

Run two worker processes against the same MySQL + Redis infrastructure and seed enough pending outbox rows to overlap claim windows.

Pass:

- claimed event-id sets are disjoint
- no durable event is lost
- duplicate delivery cannot create duplicate `mission_control_event_log.event_id`
- a killed worker's stale claims return to `pending`
- worker shutdown stops the outbox loop cleanly

## Gate F — deployment/runtime identity

Release verification must bind:

1. source commit identity
2. deployment identity
3. running runtime identity
4. public application acceptance

Do not infer production success from GitHub CI or Vercel status alone.

## Known HOLD items at source landing

- The repository TypeScript baseline currently fails before build because workspace dependencies/types are inconsistent, including unresolved `drizzle-orm`, shared `zod` resolution, duplicate `ioredis` type identity, and unrelated existing TypeScript errors.
- `server/services/mission-control/schema.ts` is the exact Mission-Control schema seam used by the new services. The monolithic `drizzle/schema.ts` still requires canonical consolidation with 0042 after the broader Drizzle dependency baseline is repaired.
- Scratch MySQL migration execution has not been evidenced.
- The Redis/MySQL integration suite has not been evidenced with `MC_INTEGRATION_TESTS=1`.
- Authenticated live `/events` acceptance has not been evidenced.
- Two-process worker acceptance has not been evidenced.

Only after Gates A–F are green may the hardening work move from **RED / HOLD** to ready-for-review / release consideration.
