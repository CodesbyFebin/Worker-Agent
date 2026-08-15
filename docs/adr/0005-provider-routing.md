# ADR-005: Provider Routing

## Status

Accepted (2025-01-09)

## Context

Worker Agent supports multiple AI providers (OpenAI, Anthropic, local models) and needs to route requests intelligently.

Options considered:

- **Single provider hardcoded**: Rejected — vendor lock-in
- **Round-robin**: Rejected — doesn't account for capability or cost
- **Provider router with policies**: Selected

## Decision

Implement a **Provider Router** that routes LLM requests based on:

### Routing Factors

1. **Model capability** — Does the model support the required feature?
2. **Cost** — Cheaper models for lower-priority tasks
3. **Rate limits** — Distribute load across providers
4. **Organization preferences** — Per-org provider allowlist

### Architecture

```
Agent Request → Provider Router → Available Provider → LLM Response
                    │                    │
              Policies (DB)            Models (OpenAI,
              Capabilities             Anthropic, Local, ...)
```

### Policy Tables

- `model_policies` — Capability + cost metadata per model
- `tool_policies` — Which models can use which tools
- `tool_gateway_policies` — Rate limiting per provider
- `governance_policies` — Blocking rules

### Fallback Chain

If the primary provider fails:

1. Log the failure in `compliance_verdicts`
2. Try the next provider in the chain
3. If all fail, route to dead letter queue
4. Alert the organization

## Consequences

- Adds routing complexity but enables multi-provider resilience
- Cost tracking is built into the routing layer
- Providers can be added/removed without code changes
- Requires `credential_refs` table for provider credentials

## Future Evolution

- Provider health monitoring (circuit breaker pattern)
- Dynamic cost optimization
- A/B testing across providers