# Events (SSE)

Worker Agent streams real-time events via Server-Sent Events (SSE).

## Endpoint

```
GET /events
```

## Authentication

Requires a valid session cookie. Events are scoped to the session's active organization.

## Event Types

| Type | Description |
|---|---|
| `connected` | Initial connection confirmation |
| `agent` | Agent execution status changes |
| `workflow` | Workflow run progress |
| `research` | Deep research phase updates |
| `heartbeat` | Keep-alive ping (every 25s) |

## Client Usage

```typescript
const es = new EventSource("/events");

es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Event:", data);
};

es.onerror = () => {
  // Auto-reconnect handled by browser
};
```

## Guarantees

- Events are filtered by organization
- Heartbeat every 25 seconds to keep connections alive
- Automatic reconnection on disconnect
- Event ordering maintained per connection