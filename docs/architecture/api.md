# API

Worker Agent exposes a type-safe tRPC API as well as REST endpoints.

## tRPC

All API communication between the Vite client and Node server uses tRPC.

### Routers

| Router | Purpose |
|---|---|
| `auth` | Login, logout, session management |
| `agents` | Agent definitions, executions, evaluations |
| `research` | Deep research creation and status |
| `workflow` | Workflow definitions, runs, step execution |
| `campaign` | Content campaign management |
| `script` | Script generation and editing |
| `youtube` | YouTube channel and video operations |
| `governance` | Policies, approvals, security events |
| `knowledge` | Knowledge base and embeddings |
| `ledger` | Claim ledger and evidence tracking |
| `tools` | Tool gateway and MCP server management |
| `godMachine` | Interactive chat and command processing |

## REST

REST endpoints provide webhook integration and external API access:

- `POST /webhooks/*` — External webhook receivers
- `GET /api/v1/*` — REST API v1

## SSE

`GET /events` — Organization-scoped real-time event streaming.

## Context

All tRPC procedures receive a context object containing:

```typescript
interface Context {
  userId: string | null;
  sessionId: string | null;
  organizationId: string | null;
  permissions: PermissionKey[];
  roleSlug: string | null;
  req: IncomingMessage;
  res: ServerResponse;
}
```