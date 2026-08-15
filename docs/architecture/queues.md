# Queues

Worker Agent uses BullMQ for distributed job queue management.

## Architecture

```
API Process → Redis → Worker Process
         (BullMQ Queue)
```

## Queue Types

| Queue | Purpose |
|---|---|
| `god-machine` | Agent execution chains |
| `campaign-day` | Daily campaign scheduling |
| `scheduled-publish` | Content publishing |
| `workflow-step` | Workflow step execution |
| `youtube-analytics` | YouTube data processing |
| `python-jobs` | Python-based analysis |

## Dead Letter Queue

Failed jobs with exhausted retries are routed to `dead_letter_jobs` table for manual review.

## Retry Policy

- Default: 3 retries
- Exponential backoff
- Max 5 minutes between attempts

## Monitoring

Queue health is available via:
- `/metrics` endpoint (Prometheus format)
- SSE events for real-time status
- Worker logs via `journal` (systemd)