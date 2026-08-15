# Tool Gateway

The Tool Gateway is Worker Agent.Cloud's unified interface for discovering, configuring, and invoking tools across multiple sources.

## Overview

The Tool Gateway provides:

- **MCP Server Integration**: Connect to external MCP servers and discover their tools
- **Built-in Tools**: Access to platform-native capabilities (YouTube publishing, research, media generation)
- **Policy Enforcement**: Organization-level allowlists/denylists for tool access
- **Audit & Cost Tracking**: All tool invocations are logged with cost attribution

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER AGENT.CLOUD                            │
│                                                                │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │   AGENTS    │───▶│  TOOL GATE   │───▶│  TOOL INVOKES   │   │
│  │ (LLMs)      │    │  W           │    │                 │   │
│  └─────────────┘    └──────────────┘    └────────┬────────┘   │
│                                                  │            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                     DATABASE LAYER                        │ │
│  │  tool_definitions ──┐                                       │ │
│  │                     ├──▶ tool_invocations (audit)         │ │
│  │  mcp_servers ────────┘                                       │ │
│  │  tool_gateway_policies                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────┼─────────────────────────────────┐
│  │                           ▼                                 │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  │   BUILTIN    │  │  MCP SERVER  │  │  EXTERNAL API   │   │
│  │  │   TOOLS      │  │   CONNECTOR  │  │                 │   │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Tool Sources

### Built-in Tools

Native platform capabilities:

| Category | Tools |
|---|---|
| Research | `research_web`, `research_paper`, `extract_claims` |
| Publishing | `publish_youtube`, `publish_tiktok`, `publish_linkedin` |
| Media | `generate_image`, `generate_video`, `generate_tts` |
| Content | `generate_script`, `optimize_title`, `generate_hashtags` |
| GitHub | `git_commit`, `git_push`, `create_pr` |

### MCP Tools

Tools discovered from registered MCP servers:

- Auto-discovered via `tools/list`
- Available in Agent Rail and Script Studio
- Subject to organization policy allowlists

## Policy Configuration

Each organization can configure `tool_gateway_policies`:

```json
{
  "allowedTools": ["research_web", "publish_youtube", "..."],
  "allowedMcpServerIds": ["server-123", "..."],
  "deniedTools": ["dangerous_command", "..."]
}
```

## Security Model

### Credential Management

Credentials are never stored in plaintext:

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Environment │────▶│ credential_refs │────▶│ Tool Invoke │
│    (env)    │     │ (envKey only)   │     │  (resolved) │
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Authorization

- **Read operations**: `tool:read` permission
- **Write operations**: `tool:invoke` permission
- **MCP servers**: Additional MCP-specific scopes

## Cost Tracking

All tool invocations are tracked:

| Metric | Source |
|---|---|
| Tokens | AI provider response headers |
| Duration | Wall-clock time |
| Cost (USD) | Calculated from provider pricing |

## Audit Logging

Each invocation is persisted:

```sql
-- Example audit entry
INSERT INTO tool_invocations (
  toolName, mcpServerId, organizationId,
  input, output, status, durationMs, error
) VALUES (
  'research_web', 'mcp-123', 'org-456',
  '{"query": "MCP protocol updates"}',
  '{"results": [...]}',
  'completed', 1247, null
);
```

## API Reference

### tRPC Procedures

| Router | Procedure | Purpose |
|---|---|---|
| `tools` | `listAvailable` | List tools accessible to the organization |
| `tools` | `invoke` | Invoke a specific tool |
| `tools` | `preview` | Preview tool input schema |

### REST Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/tools/available` | GET | List accessible tools |
| `/api/v1/tools/invoke` | POST | Invoke a tool |

## MCP Integration

### Registering MCP Servers

Via UI: **Settings → Connectors → MCP Servers**

Via API:
```typescript
await trpc.tools.registerMcpServer.mutate({
  name: "Memory Server",
  transport: "http",
  endpoint: "http://localhost:8080/mcp",
  config: JSON.stringify({
    timeout: 30000,
    allowUnauthorized: false
  })
});
```

### Discovering Tools

Tools are auto-discovered on server registration:
- Initial discovery at registration time
- Refresh available via `tools/refresh` mutation
- Discovery failures logged, server remains disabled

### Invoking MCP Tools

Once discovered, MCP tools are invoked like built-in tools:
```typescript
const result = await trpc.tools.invoke.mutate({
  toolName: "memory://server-123/list_memories",
  input: {}
});
```
