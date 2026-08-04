# Phase 7 — Tool Gateway and MCP

## What landed

- **Central tool gateway** (`invokeTool`) with permission checks, credential presence, org policy, audit logs, and durable `tool_invocations`
- **Builtin tools**: connectors.status, llm.providers, search.web, repo.status/list/read, ide.run_command, env.presence
- **MCP registry**: register HTTP/stdio servers, discover tools (`tools/list` for HTTP; `config.tools[]` for stdio), invoke via `tools/call`
- **Credential refs**: env key metadata only — never stores secret values
- **Gateway policies**: allow/deny tool names + allowed MCP server IDs
- **Tools & MCP** workspace in AppShell

## Permissions

- `tool:invoke` — list/invoke tools, view invocations/credentials/policy
- `tool:manage` — seed builtins, save policy, create credential refs
- `mcp:manage` — register/discover/enable MCP servers (owner/admin)

## Files

- `drizzle/schema.ts` + `drizzle/sql/phase7_tool_gateway.sql`
- `server/services/tools/{gateway,builtins,mcpClient}.ts`
- `server/routers/tools.router.ts`
- `client/src/features/tools/ToolsGatewayWorkspace.tsx`
- `docs/phase7-tool-gateway.md`

## How to try

1. Apply SQL: `node --env-file=.env scripts/apply-phase7-sql.mjs`
2. Restart API (permissions re-seed on bootstrap)
3. **Tools & MCP** → Seed builtins → Invoke `connectors.status` with `{}`
4. Register an HTTP MCP endpoint → Discover → Invoke discovered tool
5. Add credential ref `OPENROUTER_API_KEY` (checks presence only)

## Remaining limits

- Stdio MCP: discovery via manual `config.tools[]` only; no live process spawn yet
- MCP HTTP client is minimal JSON-RPC (not full Streamable HTTP session lifecycle for all servers)
- Agent `allowedTools` is enforced when callers pass `agentAllowedTools` into `invokeTool` — workflow agent.task does not yet auto-route all LLM tool-calls through the gateway
- No secret vault — env vars only
