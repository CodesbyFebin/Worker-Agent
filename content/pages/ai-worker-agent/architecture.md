## Direct answer

A production AI worker-agent architecture separates **interaction, orchestration, execution, tools, persistence, evidence, governance, and observability**. The model should not own all of these responsibilities. Models can decide or generate within a bounded context; the surrounding runtime should own permissions, durable state, retries, queueing, approval, logging, and external side effects.

## A layered reference architecture

A practical architecture can be understood as seven cooperating layers.

### 1. Experience layer

This is where people create goals, inspect progress, review evidence, approve sensitive actions, and consume results. It may be a chat-style command interface, a mission dashboard, a specialized editor, or an API client.

The interface should not fabricate runtime state. If a queue, research feed, or performance signal is unavailable, the product should show that absence explicitly.

### 2. API and identity layer

The API establishes who is making the request and which organization or workspace owns it. It should enforce authentication, authorization, tenancy, rate limits, and request validation before an agent or tool is invoked.

In the reviewed Worker Agent implementation, the persistent API exposes tRPC, REST, webhooks, health, metrics, and an authenticated SSE endpoint. Session cookies are opaque to the browser and the backend stores a hash of the session token rather than the raw value.

### 3. Orchestration layer

The orchestration layer translates a mission into executable work. It may contain deterministic workflows, model-driven planning, routing policies, or multiple specialized agents.

A useful rule is: **planning may be probabilistic; allowed state transitions should remain explicit**.

That means an agent can recommend the next step, but the workflow runtime decides whether the step is permitted and how it is represented in durable state.

### 4. Execution layer

This layer runs background work. Queues and workers are useful when tasks may outlive a request, require retries, consume external APIs, or need concurrency control.

The reviewed Worker Agent deployment separates the API process from the BullMQ worker process. That prevents long jobs from being coupled to interactive HTTP handling and gives the system a clearer place for retries, worker health, and queue recovery.

### 5. Tool and integration layer

Agents often need external context or capabilities. A tool layer can expose internal functions, databases, APIs, file operations, or protocol-based integrations.

MCP is one protocol for connecting LLM applications to tools and data sources. A protocol describes how components communicate; it does not replace application authorization. Tool registration, allowlists, credential boundaries, argument validation, and audit remain application responsibilities.

### 6. Persistence and evidence layer

Durable state should record enough information to recover, explain, and audit work. Depending on the system, that can include:

- workflow definitions and versions;
- workflow and step runs;
- task attempts and retry state;
- model/tool execution metadata;
- artifacts and generated files;
- claims and evidence sources;
- approval decisions;
- audit and security events;
- idempotency records.

The distinction between **state** and **evidence** is useful. State answers “where is the workflow?” Evidence answers “what supports this claim or action?”

### 7. Observability and governance layer

Health, readiness, metrics, logs, events, and traces help operators understand whether the system is functioning. Governance controls determine whether a technically possible action is allowed.

These layers overlap intentionally. For example, an approval event is both governance state and an observable event. A rejected tool call can be both a security outcome and a workflow transition.

## A reference flow

```text
User / API client
      ↓
Identity + organization context
      ↓
Mission / workflow
      ↓
Planner or deterministic step
      ↓
Tool policy / model policy
      ↓
Queue
      ↓
Worker execution
      ↓
Artifact + evidence + status
      ↓
Event stream / observability
      ↓
Approval or next transition
```

This design reduces the amount of authority placed inside a single model call.

## Where deterministic software should remain in control

Agentic behavior is useful for tasks such as classification, synthesis, ranking, planning, and drafting. Deterministic controls are usually better for:

- identity and authorization;
- organization isolation;
- allowed tools;
- monetary or destructive limits;
- approval state;
- retry ceilings;
- idempotency;
- final publication or other irreversible actions;
- retention and audit requirements.

The goal is not to eliminate autonomy. It is to place autonomy inside inspectable boundaries.

## Multi-agent architecture does not automatically mean better architecture

A system can contain one agent or many. Multiple agents can be useful when roles have genuinely different tools, prompts, policies, or evaluation criteria. They can also create additional coordination and security complexity.

Before introducing another agent, ask whether the new role creates a clear boundary that improves testing or governance. If it only renames another prompt, it may add complexity without adding control.

## Architecture risks to plan for

Agentic systems introduce familiar software risks plus new combinations involving tools, memory, model behavior, and delegation. Security planning should consider at least:

- prompt and tool manipulation;
- excessive privileges;
- unsafe external content entering the context;
- memory or state poisoning;
- cross-tenant data leakage;
- retries that duplicate side effects;
- unbounded cost or execution loops;
- stale or unsupported evidence;
- human-review bypasses.

OWASP’s agentic security work provides a useful threat-oriented complement to general AI risk frameworks such as NIST AI RMF.

## Worker Agent implementation note

Worker Agent’s source is one concrete example of this layered approach: React/Vite on the client, a persistent Express/tRPC API, MySQL/Drizzle state, Redis/BullMQ jobs, a separate worker process, authenticated organization-scoped SSE, and explicit health/readiness endpoints.

Those technologies are replaceable. The more durable architecture is the separation of concerns.

Next read [AI Worker Agent Security](/learn/ai-worker-agent/security/) and [AI Worker Agent Observability](/learn/ai-worker-agent/observability/).
