# ADR-004: Worker Queue

## Status

Accepted (2025-01-08)

## Context

Worker Agent needs a reliable job queue for:

1. Asynchronous agent execution
2. Research processing
3. Content workflows
4. Publishing pipelines

Options considered:

- **BullMQ (Redis)**: Selected — proven, battle-tested, Redis-based
- **Sidekiq (Redis/Ruby)**: Rejected — language mismatch
- **Celery (Python)**: Rejected — doesn't integrate with Node ecosystem
- **AWS SQS/SQS-like**: Rejected — adds cloud vendor dependency

## Decision

Use **BullMQ** with Redis as the backing store.

### Queue Structure

```
Queue: "god-machine"          → Agent execution chains
Queue: "campaign-day"          → Daily campaign scheduling
Queue: "scheduled-publish"    → Content publishing
Queue: "workflow-step"        → Workflow step execution
Queue: "youtube-analytics"    → YouTube data processing
Queue: "python-transcription" → Audio transcription (Python)
```

### Job Model

Each job includes:

```typescript
interface JobPayload {
  organizationId: string;     // Tenant scoping
  userId?: string;            // User context
  taskId: string;             // Correlation ID
  type: string;               // Job type
  data: unknown;              // Arbitrary payload
}
```

### Retry Policy

- Default: **3 retries**
- Backoff: Exponential (5s → 10s → 20s)
- Max delay: 5 minutes
- Dead letter queue: Failed jobs after retry exhaustion go to `dead_letter_jobs` table

### Worker Separation

```
API Process (no jobs) → Redis → Worker Process (all jobs)
```

The API process never processes jobs — it only queues them. This ensures:
- API response time is never impacted by job execution
- Workers can be scaled independently
- Failures are isolated

## Consequences

- Redis is required (already in stack for SSE)
- Jobs are durable (persisted to Redis)
- Dead letter table enables manual review
- Worker must run as separate process
- Connection limits apply (Redis)

## Monitoring

- `/metrics` endpoint exposes queue depths
- Dead letter queue is queryable via tRPC
- Worker registration is logged on startup