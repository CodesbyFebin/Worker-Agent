import { TRPCError } from "@trpc/server";
import type { mcpServers } from "../../../drizzle/schema";

type McpServerRow = typeof mcpServers.$inferSelect;

function parseConfig(raw: string | null): {
  headers?: Record<string, string>;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as {
      headers?: Record<string, string>;
      tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    };
  } catch {
    return {};
  }
}

/**
 * Minimal MCP Streamable HTTP / JSON-RPC client.
 * Speaks `tools/list` and `tools/call` — no fake tool results.
 */
async function mcpJsonRpc(
  server: McpServerRow,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  if (server.transport !== "http") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "JSON-RPC HTTP client only supports http transport",
    });
  }
  const cfg = parseConfig(server.config);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(cfg.headers ?? {}),
  };

  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params: params ?? {},
  };

  const res = await fetch(server.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  // Some servers return SSE; extract last data JSON if needed
  let jsonText = text.trim();
  if (jsonText.includes("data:")) {
    const lines = jsonText.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("data:"));
    const last = lines[lines.length - 1];
    if (last) jsonText = last.replace(/^data:\s*/, "");
  }

  let parsed: { result?: unknown; error?: { message?: string } };
  try {
    parsed = JSON.parse(jsonText) as { result?: unknown; error?: { message?: string } };
  } catch {
    throw new Error(`MCP response was not JSON: ${text.slice(0, 300)}`);
  }
  if (parsed.error) {
    throw new Error(parsed.error.message ?? "MCP error");
  }
  return parsed.result;
}

export async function discoverMcpHttpTools(
  server: McpServerRow,
): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
  const result = (await mcpJsonRpc(server, "tools/list")) as {
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  };
  if (!result?.tools?.length) {
    // Fallback: initialize then list (some servers require session)
    try {
      await mcpJsonRpc(server, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "worker-agent-cloud", version: "0.1.0" },
      });
    } catch {
      /* some servers don't need initialize */
    }
    const again = (await mcpJsonRpc(server, "tools/list")) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    };
    return again?.tools ?? [];
  }
  return result.tools;
}

export async function callMcpTool(
  server: McpServerRow,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (server.transport === "stdio") {
    throw new Error(
      "stdio MCP tool call not implemented in gateway yet — use HTTP transport or builtin tools",
    );
  }
  const result = await mcpJsonRpc(server, "tools/call", {
    name: toolName,
    arguments: args,
  });
  return result;
}
