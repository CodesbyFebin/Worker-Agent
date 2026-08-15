# Architecture Decision Records

Architecture Decision Records (ADRs) document the key decisions made during Worker Agent's development.

## What is an ADR?

An ADR is a document that captures a significant architectural decision, including:

- The **context** that led to the decision
- The **options** considered
- The **decision** made
- The **consequences** of the choice

## Why Document Decisions?

ADRs serve several purposes:

1. **Onboarding**: New contributors understand why the system works the way it does
2. **Traceability**: Decisions can be traced back to their motivations
3. **Future decisions**: Context for when circumstances change
4. **Trust**: Demonstrates thoughtful engineering, not accidental architecture

## ADR List

| # | Title | Date | Status | Summary |
|---|-------|------|--------|---------|
| [001](./0001-runtime-architecture.md) | Runtime Architecture | 2025-01-10 | Accepted | Dual-service API + Worker architecture with dual-service design |
| [002](./0002-authentication.md) | Authentication | 2025-01-15 | Accepted | Opaque session tokens with Argon2id password hashing |
| [003](./0003-event-streaming.md) | Event Streaming | 2025-01-12 | Accepted | Server-Sent Events for real-time agent updates |
| [004](./0004-worker-queue.md) | Worker Queue | 2025-01-08 | Accepted | BullMQ with Redis for job processing |
| [005](./0005-provider-routing.md) | Provider Routing | 2025-01-09 | Accepted | Policy-based LLM provider routing with fallback |

## Adding a New ADR

1. Copy `docs/adr/template.md` to `docs/adr/0NNN-short-title.md`
2. Fill in the sections
3. Submit a PR with the title `ADR-0NN: Short Title`
4. After review, it will be assigned a status

## ADR Template

```markdown
# ADR-NNN: Title

## Status
Proposed | Accepted | Superseded by [ADR-XXX](NNN-xyz.md) | Deprecated

## Context
Describe the situation that motivated the decision.

## Decision
State the decision and explain why.

## Consequences
List positive and negative consequences of the choice.
```