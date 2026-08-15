# Observability

## Overview

Worker Agent exposes operational endpoints for monitoring, logging, and health checks.

## Endpoints

### Health Check

```
GET /health
```

Returns 200 if the service is responsive.

**Response:**

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Readiness Check

```
GET /ready
```

Returns 200 only if all downstream dependencies are reachable (database, redis, smtp).

**Response:**

```json
{
  "status": "ready",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "smtp": "configured"
  }
}
```

### Metrics Endpoint

```
GET /metrics
```

Exposes Prometheus-format metrics for container monitoring.

**Key Metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `node_process_cpu_seconds_total` | Counter | Total CPU time |
| `node_process_resident_memory_bytes` | Gauge | Memory usage |
| `sse_connections_active` | Gauge | Active SSE connections |
| `sse_events_total` | Counter | Total SSE events broadcast |
| `bullmq_jobs_queued` | Gauge | Total queued jobs |
| `bullmq_jobs_active` | Gauge | Total active jobs |
| `bullmq_jobs_completed` | Counter | Total completed jobs |
| `bullmq_jobs_failed` | Counter | Total failed jobs |
| `http_request_duration_seconds` | Histogram | HTTP request latency |
| `http_requests_total` | Counter | Total HTTP requests |

### Event Stream

```
GET /events
```

SSE stream for real-time agent and workflow events.

**Event Format:**

```typescript
interface SSEEvent {
  type: "connected" | "agent" | "workflow" | "research" | "heartbeat";
  organizationId: string;
  payload: Record<string, any>;
}
```

## Worker Status

The API exposes worker registration status at `/api/v1/workers`.

**Response:**

```json
[
  {
    "id": "worker_abc123",
    "organizationId": "org_xyz789",
    "status": "active",
    "lastSeen": "2025-01-15T10:30:00Z",
    "queues": ["god-machine", "workflow-step"]
  }
]
```

## Queue Status

Queue depths are exposed via `/api/v1/queues`.

**Response:**

```json
[
  {
    "name": "god-machine",
    "waiting": 5,
    "active": 2,
    "completed": 142,
    "failed": 3,
    "delayed": 1
  }
]
```

## Failure Handling

### Dead Letter Queue

Failed jobs (after 3 retries) are moved to the `dead_letter_jobs` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `queueName` | String | Source queue |
| `payload` | JSON | Original job payload |
| `error` | JSON | Error details |
| `attempts` | Integer | Retry count |
| `failedAt` | Timestamp | When it failed |
| `resolvedAt` | Timestamp | When resolved (nullable) |

### Alerting

The system automatically alerts on:

- Worker offline for >15 minutes
- Dead letter queue growth >10 jobs
- SSE event backlog >100 events
- Database connection pool >90% utilization

## Logging

All services log in structured JSON format:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "service": "api-server",
  "organizationId": "org_xyz789",
  "userId": "user_abc123",
  "requestId": "req_def456",
  "message": "Agent stream started",
  "context": {
    "agentId": "agent_ghi789",
    "provider": "openai"
  }
}
```

## Docker Observability

When running via Docker, these metrics are available on port `:9090`.

Prometheus can be configured to scrape:

```yaml
scrape_configs:
  - job_name: "worker-agent"
    static_configs:
      - targets: ["localhost:4000"]
    metrics_path: "/metrics"
```