# ADR-003: Event Streaming

## Status

Accepted (2025-01-12)

## Context

Worker Agent needs real-time event streaming for:

1. Agent execution progress
2. Research phase updates
3. Workflow step transitions
4. System health status

Options considered:

- **WebSockets**: Higher complexity, unnecessary bidirectional requirement
- **Server-Sent Events (SSE)**: Selected — browser-native, simpler
- **GraphQL subscriptions**: Adds schema complexity
- **Polling**: Inefficient, higher latency

## Decision

Use **Server-Sent Events (SSE)** with the following design:

### Endpoint

```
GET /events
```

### Authentication

- Requires valid session cookie
- 401 if unauthenticated
- Organization derived from session context

### Scoping

Events are filtered by `organizationId`:

```typescript
// Server-side scoping
const unsub = subscribeToEvents(handler, organizationId);
```

This ensures Organization A NEVER receives Organization B's events.

### Event Format

```json
{
  "type": "agent" | "workflow" | "research" | "connected" | "heartbeat",
  "organizationId": "uuid",
  "payload": { ... }
}
```

### Lifecycle

```
Client connects → Server sends "connected" → 25s heartbeats →
Client disconnects → Server cleanup (interval + subscription)
```

### Connection Management

- Max 50 listeners per EventEmitter (configurable)
- Heartbeat every 25 seconds (before nginx 60s timeout)
- `proxy_buffering off` in Nginx config
- `Cache-Control: no-cache` headers

## Consequences

- SSE is unidirectional (server → client) — sufficient for our use case
- Browser reconnection is automatic (EventSource API)
- Organization isolation is enforced server-side
- Requires Nginx config for no-buffering
- HTTP/2 compatible