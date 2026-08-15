# MCP Capability Catalog — Worker Agent.Cloud

This catalog documents the MCP client connectivity capabilities built into Worker Agent.Cloud.

## Overview

Worker Agent.Cloud includes a **minimal MCP Streamable HTTP/JSON-RPC client** for connecting to external MCP servers. This enables the platform to discover and invoke tools from any compliant MCP server.

## Transport Support

| Transport | Status | Description |
|---|---|---|
| HTTP/SSE | ✅ Implemented | JSON-RPC over HTTP with SSE fallback |
| Stdio | ⚠️ Partial | JSON-RPC via stdin/stdout (discovery mode) |

## Implementation Location

`server/services/tools/mcpClient.ts` — 121 lines

The client provides:
- `mcpJsonRpc()` — Core JSON-RPC request handler
- `discoverMcpHttpTools()` — Discovers tools from an MCP server via `tools/list`
- `discoverMcpResources()` — Discovers resources from an MCP server
- `callMcpTool()` — Invokes a specific tool on an MCP server

## Configuration Schema

MCP servers are registered in the database via `mcp_servers` table:

```typescript
{
  name: string;
  transport: "http" | "stdio";
  endpoint: string;
  config: string;
  enabled: boolean;
}
```

## Supported Operations

| Operation | Status | Notes |
|---|---|---|
| Initialize | ✅ | Protocol version 2024-11-05 |
| Tools/List | ✅ | Full tool discovery |
| Tools/Call | ✅ | Tool invocation with input validation |
| Resources/List | ✅ | Resource discovery |
| Resources/Read | ⚠️ | Partial support |
| Prompts/List | ⚠️ | Not yet implemented |
| Prompts/Get | ⚠️ | Not yet implemented |

## Security Controls

The MCP client implements:

1. **Transport Security**
   - HTTPS enforced for HTTP endpoints
   - Optional headers from configuration

2. **Sandboxing**
   - Tool calls subject to organization-level allowlists
   - Rate limiting per organization
   - Credential references (env var names) never stored in plaintext

3. **Input Validation**
   - JSON Schema validation for tool inputs
   - Timeout handling (configurable per server)

4. **Audit Logging**
   - All MCP invocations logged via `toolInvocations` table
   - Error messages redacted before persistence

## Integration Points

- **Tool Gateway**: MCP tools flow through the organization-scoped Tool Gateway
- **Agent System**: Agents can discover and invoke MCP tools
- **Workflow Engine**: MCP tools can be nodes in workflow graphs

