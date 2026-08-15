# Workspaces

Worker Agent uses a multi-tenant workspace model for strict organization isolation.

## Architecture

```
User → Session → Organization → Workspaces → Resources
```

## Workspace Types

| Workspace | Purpose |
|---|---|
| **Overview** | Command center dashboard |
| **Missions** | Agent execution and monitoring |
| **Intelligence** | Deep research and analysis |
| **Content** | Content operations studio |
| **Channels** | YouTube channel management |
| **Automation** | Workflow and pipeline editor |
| **Governance** | Policy, approvals, compliance |
| **Agents** | Agent definitions and execution |
| **Learn** | Knowledge base and tutorials |
| **Settings** | Organization configuration |

## Isolation

All data access is scoped by `organizationId`:
- tRPC procedures use `organizationProcedure`
- SSE events are filtered by organization
- Database queries include `organizationId` conditions
- Worker jobs are tagged with organization context