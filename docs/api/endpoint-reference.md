# API Endpoint Reference

Worker Agent.Cloud provides both tRPC and REST APIs for integration.

## Authentication

All API endpoints require authentication via session cookies.

## tRPC Endpoints

For full type safety, use the tRPC client. See `client/src/lib/trpc.ts`.

### Auth Router

| Procedure | Method | Description |
|---|---|---|
| `devLogin` | Mutation | Development-only login |
| `logout` | Mutation | End session |
| `me` | Query | Get current user |
| `listOrganizations` | Query | List user organizations |
| `switchOrganization` | Mutation | Switch active organization |

### God Machine Router

| Procedure | Method | Description |
|---|---|---|
| `dispatchGoal` | Mutation | Dispatch a new goal |
| `runSubtask` | Mutation | Run a specific subtask |
| `getTaskTree` | Query | Get full task tree |
| `listRootTasks` | Query | List root-level tasks |
| `listActive` | Query | List active tasks |

### Campaign Router

| Procedure | Method | Description |
|---|---|---|
| `start` | Mutation | Start a new campaign |
| `list` | Query | List campaign |
| `getDays` | Query | Get campaign days |
| `approveDay` | Mutation | Approve a campaign day |

## REST API v1

Base URL: `/api/v1`

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/workflows` | GET | List workflows |
| `/goals` | POST | Dispatch new goal |
| `/campaigns` | GET | List campaigns |
| `/youtube/channels` | GET | List YouTube channels |
| `/knowledge/search` | GET | Search knowledge |

## SSE Events

Subscribe to real-time events:

```
GET /events
```

Events include: `task_started`, `task_completed`, `task_failed`, `metrics_update`.

## Error Handling

All errors follow tRPC's structured error format:

```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```
