## Direct answer

AI worker-agent security is the practice of constraining what an agent can see, decide, and do while preserving enough evidence to detect misuse and recover from failure. A secure design assumes that model output, external content, tools, memory, and integrations can all become attack surfaces. The runtime—not the model—should enforce identity, least privilege, organization isolation, tool permissions, execution limits, and approval boundaries.

## Security starts with authority

The first security question is not “Which model is safest?” It is “What authority does this agent have?”

Define authority across four dimensions:

1. **Data authority** — what the agent can read.
2. **Tool authority** — what functions or APIs it can invoke.
3. **State authority** — what records it can create or modify.
4. **External authority** — what side effects it can cause outside the system.

These permissions should be enforced by application code and infrastructure controls rather than by instructions in a prompt alone.

## Identity and organization isolation

Agentic systems often operate on behalf of users, teams, or organizations. Session and tenancy boundaries need to carry through every API, background job, event stream, and tool call.

In the reviewed Worker Agent implementation, the API resolves an HTTP-only session cookie and associates the session with a user and organization. Its SSE endpoint rejects unauthenticated requests and filters subscriptions by organization. Those are concrete examples of applying the same authorization boundary to realtime events as to ordinary requests.

A similar rule should apply to queued jobs: the job should carry an organization identifier that is validated before data is read or modified.

## Tool security

Tools expand an agent’s power and attack surface. A tool can expose sensitive data, make irreversible changes, or connect the agent to untrusted external content.

Use explicit controls:

- allowlist tools per agent or role;
- validate arguments before execution;
- separate read tools from write tools;
- require approval for sensitive writes;
- isolate credentials from model-visible text;
- redact secrets from logs and artifacts;
- apply timeouts and resource limits;
- record the tool name, result status, and relevant evidence.

MCP can standardize how an application communicates with tools and context providers, but protocol compatibility is not a security decision by itself. An MCP server still needs trust evaluation, permissions, and operational monitoring.

## Prompt injection and untrusted content

An agent that reads the web, documents, email, tickets, or other user-controlled sources should treat that material as untrusted data. Instructions embedded inside external content can attempt to redirect the agent away from its mission or persuade it to disclose data or use tools improperly.

Useful defenses include separating system policy from retrieved content, limiting tool authority, validating tool inputs, requiring approval before sensitive actions, and testing the agent with adversarial content.

OWASP’s Agentic Security Initiative treats tool use, memory, identity, and multi-step autonomy as important security areas. Its guidance is useful because agentic systems combine familiar application risks with model-driven behavior and delegated authority.

## Memory and state risks

Persistent memory can improve continuity, but it can also preserve incorrect, manipulated, or sensitive information longer than intended.

For durable state:

- define who can write memory;
- distinguish evidence from inference;
- record provenance when practical;
- set retention and deletion rules;
- prevent one organization from reading another’s state;
- avoid silently promoting model-generated summaries into trusted facts.

A “memory” feature should not become an unreviewed global truth store.

## Queue and retry safety

Background execution introduces operational security concerns. A retry can repeat an external side effect if the workflow is not idempotent.

For actions such as publishing, sending a message, or modifying an external system, use an idempotency key or another mechanism that makes duplicate execution detectable and safe.

Set explicit retry ceilings. A failed job should eventually enter a recoverable error state instead of looping indefinitely.

## Session security

The reviewed Worker Agent session implementation generates a random session token, stores a SHA-256 hash of the token in the database, and sends the raw token in an HTTP-only, SameSite cookie. In production it adds the `Secure` attribute.

That pattern protects the stored token from direct reuse if the session table is exposed, but it does not eliminate the need for TLS, session expiry, revocation, CSRF/origin controls where relevant, audit logging, and production-grade authentication.

## Logging without leaking sensitive data

Observability can create its own exposure risk. Avoid writing full prompts, credentials, access tokens, private documents, or sensitive tool responses into generic logs unless there is a specific protected retention design.

Prefer structured metadata such as:

- mission or run ID;
- organization ID;
- step name;
- tool name;
- status;
- latency;
- redacted error category;
- evidence/artifact identifiers.

Sensitive content can be stored in dedicated protected artifacts when the workflow genuinely requires it.

## Human approval as a security control

Human review is valuable when a technically permitted action has higher impact than the system should execute autonomously. It is especially useful for destructive writes, external publication, sensitive communications, security changes, or actions with legal or financial consequences.

Approval is strongest when the backend enforces it. A frontend confirmation dialog alone does not prevent another client or background worker from bypassing the intended boundary.

## Security is a lifecycle process

NIST AI RMF and its Generative AI Profile frame AI risk management across design, deployment, operation, and evaluation. That lifecycle framing is appropriate for worker agents because risk changes as tools, models, permissions, and data sources change.

Security reviews therefore need to be repeated when the system gains new capabilities.

For the complementary operating model, read [AI Worker Agent Governance](/learn/ai-worker-agent/governance/) and [Human Approval in AI Worker Agent Systems](/learn/ai-worker-agent/human-approval/).
