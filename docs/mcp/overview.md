# MCP Integration Overview

Worker Agent.Cloud can connect to external Model Context Protocol (MCP) servers to discover and invoke custom tools.

## What is MCP?

The Model Context Protocol (MCP) is an open standard for connecting AI applications to external tools and data sources. MCP servers expose tools, resources, and prompts that can be invoked by AI assistants.

## Integration Type

Worker Agent.Cloud implements an **MCP client** — it can connect to MCP servers but does not provide MCP server capabilities itself.

## Getting Started

1. **Navigate to Settings → Connectors → MCP Servers**
2. **Add Server**: Provide name, transport type, and endpoint
3. **Discover Tools**: Click "Refresh" to auto-discover available tools
4. **Configure Policy**: Add discovered tools to your allowlist
5. **Use in Workflows**: Tools appear in Agent Rail and workflow definitions

## Supported Transports

| Transport | Status | Notes |
|---|---|---|
| HTTP | ✅ Full support | JSON-RPC over HTTP with SSE fallback |
| Stdio | ⚠️ Partial | Requires proper environment setup |

## Tool Discovery

When an MCP server is registered:

1. Server sends `initialize` request with protocol version
2. Server responds with capabilities and instructions
3. Client sends `tools/list` to discover available tools
4. Tools are added to database and UI

## Security Model

- HTTPS enforced for HTTP connections
- Optional bearer token authentication via configuration headers
- Environment variable references for secrets (never stored in plaintext)
- Organization-level tool allowlists/denylists
- All invocations audited via `toolInvocations` table

## Common Use Cases

### Research Enhancement

Connect to a web-search MCP server for enhanced research capabilities:

```
Researcher Agent → Call MCP search tool → Get fresh results
```

### Data Access

Connect to a database MCP server for structured data access:

```
Workflow → Read customer data via MCP resource → Generate report
```

### External Services

Connect to specialized MCP servers for:
- File system operations
- API integrations
- Domain-specific tools

## Limitations

- **Tool descriptions** must be clear and LLM-friendly (no SEO keywords)
- **Input schemas** must be strict and well-defined
- **Tools are not automatic** — must be added to organization allowlist
- **Error handling** requires graceful fallback behavior

