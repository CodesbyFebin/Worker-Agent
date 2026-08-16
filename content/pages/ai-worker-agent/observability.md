## Direct answer

AI worker-agent observability is the ability to determine **whether the runtime is healthy, what a mission is doing, why it changed state, which tools and providers were involved, and where failures occurred**. It should expose operational evidence without pretending that unavailable metrics exist. Good observability covers infrastructure, workflow state, model/tool execution, security events, and approval transitions.

## Start with health and readiness

Liveness and readiness answer different questions.

- **Liveness** asks whether the API process is running.
- **Readiness** asks whether the service can actually perform work with its required dependencies.

The reviewed Worker Agent deployment documents `/health` for liveness and `/ready` for database and Redis checks. A load balancer or deployment platform should use readiness when deciding whether an instance should receive traffic.

A green process with a disconnected database is not a healthy application.

## Observe API and event delivery

Track request-level information such as:

- route or procedure;
- response status;
- latency;
- request or correlation ID;
- organization context where safe;
- rate-limit outcomes;
- error category.

For SSE or other realtime delivery, also monitor connection state and delivery failures. The UI should distinguish `CONNECTING`, `LIVE`, `STALE`, `ERROR`, and `NO FEED` instead of using one generic online indicator.

## Observe workflow state

A mission should be traceable through explicit workflow states rather than inferred from chat messages.

Useful fields include:

- workflow run ID;
- current step;
- step status;
- start and completion timestamps;
- retry count;
- queue job ID;
- error code or reason;
- result or artifact identifiers;
- approval state.

This makes it possible to answer “where is the work?” without inspecting raw logs manually.

## Observe queues and workers

Queue-backed worker agents need visibility into execution capacity and failure behavior.

Track at least:

- waiting jobs;
- active jobs;
- completed and failed jobs;
- retry counts;
- dead-letter or exhausted jobs;
- worker heartbeat or process status;
- queue latency;
- unusually long-running jobs.

A dashboard should not label workers “active” unless a real source supports that status.

## Observe model and tool execution

Model and tool calls are operational dependencies. Useful metadata can include:

- provider and model name when known;
- selected routing lane or policy;
- tool name;
- duration;
- success/failure;
- token or cost data when the provider returns it;
- retry/fallback attempts;
- artifact or evidence references.

Do not invent cost or usage figures when the provider does not return them.

## Observe evidence quality

For research and evidence-aware workflows, observability should show whether claims have support.

Signals may include:

- evidence source count;
- last fetch time;
- verification status;
- conflicting sources;
- stale evidence;
- missing required evidence;
- source-fetch errors.

This is especially important when a workflow can continue automatically. An execution can be technically successful while producing weak evidence.

## Observe approvals

Approval queues deserve their own operational signals:

- pending approvals;
- oldest pending item;
- time-to-review;
- approved/rejected/change-requested outcomes;
- protected actions waiting for authorization.

These metrics help distinguish an agent failure from a deliberate governance pause.

## Logs, metrics, events, and traces serve different purposes

A mature system benefits from several telemetry types:

- **Logs** explain discrete events and errors.
- **Metrics** summarize behavior over time.
- **Events** describe domain state changes for consumers and UI updates.
- **Traces** connect work across services or steps.

Do not force every operational question into one data format.

## Protect sensitive telemetry

Observability must not become a data-leak path. Avoid placing secrets, raw access tokens, confidential documents, or unnecessary prompt content in general-purpose logs.

Prefer identifiers and redacted metadata, then link to a protected artifact when deeper inspection is authorized.

Metrics endpoints should also be treated as operational surfaces. The reviewed Worker Agent deployment recommends keeping `/metrics` behind authentication or an internal network in hardened deployments.

## Build dashboards from real sources

An honest operator console should render each status from an identified source. For example:

```text
API health         ← /health
Dependency ready   ← /ready
Research events    ← authenticated SSE
Mission state      ← workflow/campaign query
Approval state     ← approval records
Queue state        ← BullMQ/worker telemetry
Evidence state     ← claim/evidence records
```

If a source is not implemented, show `NOT CONFIGURED` rather than a sample value that looks live.

## Define service objectives only after measuring reality

Do not claim uptime, response-time percentiles, or error budgets until measurement is actually deployed and the observation window is defined.

A useful progression is:

1. establish trustworthy instrumentation;
2. collect a baseline;
3. define service-level indicators;
4. set objectives based on user needs;
5. alert on meaningful deviations.

Observability should reduce uncertainty, not create more polished uncertainty.

For deployment boundaries, read [Self-Hosting an AI Worker Agent Runtime](/learn/ai-worker-agent/self-hosting/). For security considerations, read [AI Worker Agent Security](/learn/ai-worker-agent/security/).
