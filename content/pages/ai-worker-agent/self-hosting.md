## Direct answer

Self-hosting an AI worker-agent runtime means running the web client, persistent API, background worker, database, queue, and optional object storage under infrastructure you control. A reliable deployment keeps interactive HTTP traffic separate from long-running worker execution, exposes health/readiness checks, protects internal services from the public internet, and uses TLS before production session cookies or sensitive workflows are enabled.

## Reference topology

A straightforward production topology is:

```text
Internet
  ↓
TLS reverse proxy
  ├── static web
  ├── /trpc
  ├── /events
  ├── /health
  └── /ready
       ↓
Persistent API
  ├── MySQL / MariaDB
  └── Redis
       ↓
BullMQ worker
```

Optional object storage can sit on the private service network when artifacts need durable blob storage.

The exact products can change. The important boundary is that the browser does not connect directly to the database, Redis, or worker process.

## Separate the API and worker

Interactive API traffic and background agent work have different operating characteristics.

The API should remain responsive while the worker executes slower jobs, retries external calls, or waits on resource-intensive tasks. Running both roles in one process can make failures harder to isolate and can cause long jobs to affect request latency.

The reviewed Worker Agent deployment uses two Node processes: an API process for HTTP/tRPC/SSE/health/metrics and a worker process for BullMQ processors.

## Keep databases and queues private

MySQL/MariaDB and Redis should normally be reachable only from trusted application services.

Do not expose database or Redis ports publicly simply because the application is self-hosted. Use a private Docker network, host firewall, or equivalent network control.

Credentials belong in server-side environment variables or a secret manager, not in frontend `VITE_*` variables or committed files.

## Use same-origin routing where practical

For browser-facing deployments, routing the web app and API under one public origin simplifies cookies, CORS, and SSE behavior.

Example:

```text
https://workeragent.example/          → static web
https://workeragent.example/trpc      → API
https://workeragent.example/events    → API SSE
https://workeragent.example/health    → API
https://workeragent.example/ready     → API
```

The reverse proxy can route these paths to the persistent Node service while serving built frontend files directly.

## Configure SSE correctly

Server-Sent Events use a long-lived HTTP response. Reverse proxies should avoid buffering the event stream and should allow connections to remain open long enough for normal operation.

The application should authenticate the stream and scope events to the same tenant or organization rules used by ordinary API requests.

After deployment, test an unauthenticated `/events` request and an authenticated organization-scoped connection explicitly. Do not assume SSE works because normal JSON requests work.

## Health and readiness

Use different probes for different decisions.

The Worker Agent deployment model documents:

- `/health` as a liveness probe;
- `/ready` as a database + Redis readiness probe;
- `/metrics` as an operational metrics surface.

A container orchestrator or reverse proxy should prefer readiness for traffic decisions. Keep metrics private or authenticated in hardened deployments.

## Database bootstrap

A self-hosted release is not reproducible until a clean database can reach the required schema deterministically.

Before production cutover:

1. freeze the exact source revision;
2. generate or verify the migration/baseline from that source;
3. apply it to an empty database;
4. verify tables, indexes, and constraints;
5. start the API and worker against that database;
6. confirm readiness succeeds.

Do not test destructive bootstrap commands against a production database that already contains data.

## Redis and BullMQ

Redis stores queue state for BullMQ. Treat it as a production dependency rather than an optional cache when jobs depend on it.

Operational checks should cover:

- Redis connectivity;
- worker process status;
- waiting and failed jobs;
- retry exhaustion;
- restart behavior.

If Redis is unavailable, readiness should not imply that the complete worker-agent runtime is healthy.

## TLS and sessions

The reviewed Worker Agent session implementation adds the `Secure` cookie attribute in production. That means production authentication should be served through HTTPS.

TLS termination can happen at the reverse proxy, but the public origin should remain HTTPS-only. Redirect plaintext HTTP to HTTPS and use a certificate renewal process that does not depend on manual intervention.

## Backups

Back up state according to recovery needs, not just convenience.

At minimum consider:

- database backups;
- persistent object/artifact storage;
- configuration needed to recreate services;
- tested restoration steps.

Redis persistence requirements depend on the queue/recovery design, but a database backup does not automatically recover in-flight queue state.

## Upgrade discipline

Agent runtimes combine application code, provider SDKs, database schema, queues, and external tools. Dependency upgrades can change types and runtime behavior even when the visual interface looks unchanged.

Use a release sequence such as:

```text
source identity
→ CI build and tests
→ immutable deployment identity
→ running API/worker identity
→ readiness
→ authenticated workflow acceptance
→ organization-isolation tests
```

Only then move traffic or retire the previous deployment.

## UTM or local Linux hosting

A Linux VM can host this topology for development, lab, or public self-hosting if the machine has enough CPU, memory, disk, and reliable networking. A self-hosting control plane such as Coolify can manage containerized applications, but the same application-level acceptance tests remain necessary.

The hosting dashboard does not prove that API, worker, queue, database, authentication, and SSE are functioning together.

For the implementation sequence before deployment, read [AI Worker Agent Implementation Roadmap](/learn/ai-worker-agent/implementation/). For operational visibility, read [AI Worker Agent Observability](/learn/ai-worker-agent/observability/).
