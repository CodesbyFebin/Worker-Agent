import { randomUUID } from "crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  credentialRefs,
  mcpServers,
  toolDefinitions,
  toolGatewayPolicies,
  toolInvocations,
} from "../../../drizzle/schema";
import { db } from "../../_core/db";
import { writeAuditLog } from "../../_core/auth/audit";
import { env } from "../../_core/env";
import { executeBuiltinTool, listBuiltinToolSpecs } from "./builtins";
import { callMcpTool, discoverMcpHttpTools } from "./mcpClient";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function ensureBuiltinToolsSeeded(): Promise<void> {
  const specs = listBuiltinToolSpecs();
  for (const spec of specs) {
    const [existing] = await db
      .select()
      .from(toolDefinitions)
      .where(and(eq(toolDefinitions.name, spec.name), isNull(toolDefinitions.organizationId)))
      .limit(1);
    if (existing) continue;
    await db.insert(toolDefinitions).values({
      id: randomUUID(),
      organizationId: null,
      name: spec.name,
      displayName: spec.displayName,
      description: spec.description,
      source: "builtin",
      mcpServerId: null,
      inputSchema: JSON.stringify(spec.inputSchema),
      requiredPermission: spec.requiredPermission,
      credentialProvider: spec.credentialProvider ?? null,
      enabled: true,
    });
  }
}

export async function listDiscoverableTools(organizationId: string) {
  await ensureBuiltinToolsSeeded();
  const rows = await db
    .select()
    .from(toolDefinitions)
    .where(
      or(isNull(toolDefinitions.organizationId), eq(toolDefinitions.organizationId, organizationId)),
    )
    .orderBy(desc(toolDefinitions.updatedAt));

  return rows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      source: r.source,
      mcpServerId: r.mcpServerId,
      inputSchema: parseJson(r.inputSchema, {}),
      requiredPermission: r.requiredPermission,
      credentialProvider: r.credentialProvider,
      credentialConfigured: r.credentialProvider
        ? isCredentialConfigured(r.credentialProvider)
        : true,
    }));
}

function isCredentialConfigured(provider: string): boolean {
  const map: Record<string, string | undefined> = {
    openrouter: env.OPENROUTER_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    tavily: env.TAVILY_API_KEY,
    brave: env.BRAVE_SEARCH_API_KEY,
    serper: env.SERPER_API_KEY,
    github: env.GITHUB_TOKEN,
    groq: env.GROQ_API_KEY,
    gemini: env.GEMINI_API_KEY,
    nvidia: env.NVIDIA_API_KEY,
  };
  const key = map[provider];
  if (provider === "search") {
    return Boolean(env.TAVILY_API_KEY || env.BRAVE_SEARCH_API_KEY || env.SERPER_API_KEY);
  }
  return Boolean(key);
}

async function getDefaultPolicy(organizationId: string) {
  const [policy] = await db
    .select()
    .from(toolGatewayPolicies)
    .where(
      and(
        eq(toolGatewayPolicies.organizationId, organizationId),
        eq(toolGatewayPolicies.isDefault, true),
      ),
    )
    .limit(1);
  return policy ?? null;
}

export type InvokeToolParams = {
  organizationId: string;
  actorUserId: string;
  permissions: string[];
  toolName: string;
  input: Record<string, unknown>;
  agentExecutionId?: string;
  /** Extra allow-list from agent tool policy — if provided, tool must be in this list when non-empty */
  agentAllowedTools?: string[];
};

export type InvokeToolResult = {
  invocationId: string;
  status: "completed" | "failed" | "denied";
  output: unknown;
  error: string | null;
  durationMs: number;
};

export async function invokeTool(params: InvokeToolParams): Promise<InvokeToolResult> {
  await ensureBuiltinToolsSeeded();

  const [tool] = await db
    .select()
    .from(toolDefinitions)
    .where(
      and(
        eq(toolDefinitions.name, params.toolName),
        or(isNull(toolDefinitions.organizationId), eq(toolDefinitions.organizationId, params.organizationId)),
      ),
    )
    .limit(1);

  const invocationId = randomUUID();
  const started = Date.now();

  const deny = async (reason: string): Promise<InvokeToolResult> => {
    await db.insert(toolInvocations).values({
      id: invocationId,
      organizationId: params.organizationId,
      toolName: params.toolName,
      toolDefinitionId: tool?.id ?? null,
      mcpServerId: tool?.mcpServerId ?? null,
      actorUserId: params.actorUserId,
      agentExecutionId: params.agentExecutionId ?? null,
      status: "denied",
      input: JSON.stringify(params.input),
      error: reason,
      durationMs: Date.now() - started,
      completedAt: new Date(),
    });
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "tool.denied",
      resourceType: "tool",
      resourceId: params.toolName.slice(0, 64),
      payload: { reason },
    });
    try {
      const { recordSecurityEvent } = await import("../governance/engine");
      await recordSecurityEvent({
        organizationId: params.organizationId,
        severity: "medium",
        kind: "tool.denied",
        message: reason,
        actorUserId: params.actorUserId,
        resourceType: "tool",
        resourceId: params.toolName.slice(0, 64),
      });
    } catch {
      /* non-fatal */
    }
    return {
      invocationId,
      status: "denied",
      output: null,
      error: reason,
      durationMs: Date.now() - started,
    };
  };

  if (!tool || !tool.enabled) {
    return deny(`Unknown or disabled tool: ${params.toolName}`);
  }

  const required = tool.requiredPermission;
  if (!params.permissions.includes(required) && !params.permissions.includes("tool:manage")) {
    return deny(`Missing permission: ${required}`);
  }

  if (params.agentAllowedTools && params.agentAllowedTools.length > 0) {
    if (!params.agentAllowedTools.includes(params.toolName)) {
      return deny(`Tool not in agent allow-list: ${params.toolName}`);
    }
  }

  const policy = await getDefaultPolicy(params.organizationId);
  if (policy) {
    const denied = parseJson<string[]>(policy.deniedTools, []);
    if (denied.includes(params.toolName)) {
      return deny(`Denied by gateway policy: ${params.toolName}`);
    }
    const allowed = parseJson<string[]>(policy.allowedTools, []);
    if (allowed.length > 0 && !allowed.includes(params.toolName) && tool.source === "mcp") {
      return deny(`Not in gateway allow-list: ${params.toolName}`);
    }
    if (tool.source === "mcp" && tool.mcpServerId) {
      const allowedServers = parseJson<string[]>(policy.allowedMcpServerIds, []);
      if (allowedServers.length > 0 && !allowedServers.includes(tool.mcpServerId)) {
        return deny(`MCP server not allowed by policy`);
      }
    }
  } else if (tool.source === "mcp") {
    // No policy yet: require explicit allow of MCP via enabled server only
  }

  if (tool.credentialProvider && !isCredentialConfigured(tool.credentialProvider)) {
    return deny(`Credential not configured for provider: ${tool.credentialProvider}`);
  }

  await db.insert(toolInvocations).values({
    id: invocationId,
    organizationId: params.organizationId,
    toolName: params.toolName,
    toolDefinitionId: tool.id,
    mcpServerId: tool.mcpServerId,
    actorUserId: params.actorUserId,
    agentExecutionId: params.agentExecutionId ?? null,
    status: "running",
    input: JSON.stringify(params.input),
  });

  try {
    let output: unknown;
    if (tool.source === "builtin") {
      output = await executeBuiltinTool(params.toolName, params.input, {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
      });
    } else if (tool.source === "mcp" && tool.mcpServerId) {
      const [server] = await db
        .select()
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.id, tool.mcpServerId),
            eq(mcpServers.organizationId, params.organizationId),
          ),
        )
        .limit(1);
      if (!server || !server.enabled) {
        throw new Error("MCP server missing or disabled");
      }
      const schemaMeta = parseJson<{ remoteName?: string }>(tool.inputSchema, {});
      const remoteName =
        schemaMeta.remoteName ??
        (params.toolName.includes(".")
          ? params.toolName.split(".").slice(2).join(".")
          : params.toolName);
      if (!remoteName) throw new Error("MCP remote tool name missing");
      output = await callMcpTool(server, remoteName, params.input);
    } else {
      throw new Error("Unsupported tool source");
    }

    const durationMs = Date.now() - started;
    await db
      .update(toolInvocations)
      .set({
        status: "completed",
        output: JSON.stringify(output),
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(toolInvocations.id, invocationId));

    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "tool.invoke",
      resourceType: "tool",
      resourceId: params.toolName.slice(0, 64),
      payload: { invocationId, durationMs, status: "completed" },
    });

    return { invocationId, status: "completed", output, error: null, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;
    await db
      .update(toolInvocations)
      .set({
        status: "failed",
        error: message,
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(toolInvocations.id, invocationId));

    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "tool.invoke_failed",
      resourceType: "tool",
      resourceId: params.toolName.slice(0, 64),
      payload: { invocationId, error: message },
    });

    return { invocationId, status: "failed", output: null, error: message, durationMs };
  }
}

export async function registerMcpServer(params: {
  organizationId: string;
  userId: string;
  name: string;
  transport: "http" | "stdio";
  endpoint: string;
  config?: Record<string, unknown>;
}) {
  const id = randomUUID();
  await db.insert(mcpServers).values({
    id,
    organizationId: params.organizationId,
    name: params.name,
    transport: params.transport,
    endpoint: params.endpoint,
    config: params.config ? JSON.stringify(params.config) : null,
    enabled: true,
    createdBy: params.userId,
  });
  return { serverId: id };
}

export async function discoverMcpServer(organizationId: string, serverId: string) {
  const [server] = await db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.id, serverId), eq(mcpServers.organizationId, organizationId)))
    .limit(1);
  if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });

  try {
    let tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    if (server.transport === "http") {
      tools = await discoverMcpHttpTools(server);
    } else {
      // stdio: accept manual tool catalog from config.tools if present
      const cfg = parseJson<{ tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> }>(
        server.config,
        {},
      );
      if (!cfg.tools?.length) {
        throw new Error(
          "stdio MCP discovery requires config.tools[] catalog (live stdio spawn listing comes later)",
        );
      }
      tools = cfg.tools;
    }

    // Remove previous MCP tool defs for this server
    await db.delete(toolDefinitions).where(eq(toolDefinitions.mcpServerId, serverId));

    for (const t of tools) {
      const toolName = `mcp.${serverId.slice(0, 8)}.${t.name}`;
      await db.insert(toolDefinitions).values({
        id: randomUUID(),
        organizationId,
        name: toolName,
        displayName: `${server.name}: ${t.name}`,
        description: t.description ?? `MCP tool ${t.name}`,
        source: "mcp",
        mcpServerId: serverId,
        inputSchema: JSON.stringify({ ...(t.inputSchema as object), remoteName: t.name }),
        requiredPermission: "tool:invoke",
        credentialProvider: null,
        enabled: true,
      });
    }

    await db
      .update(mcpServers)
      .set({ lastDiscoveredAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(mcpServers.id, serverId));

    return { discovered: tools.length, tools: tools.map((t) => t.name) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(mcpServers)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(mcpServers.id, serverId));
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
}

export async function upsertDefaultPolicy(params: {
  organizationId: string;
  allowedTools: string[];
  allowedMcpServerIds: string[];
  deniedTools: string[];
}) {
  const [existing] = await db
    .select()
    .from(toolGatewayPolicies)
    .where(
      and(
        eq(toolGatewayPolicies.organizationId, params.organizationId),
        eq(toolGatewayPolicies.isDefault, true),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(toolGatewayPolicies)
      .set({
        allowedTools: JSON.stringify(params.allowedTools),
        allowedMcpServerIds: JSON.stringify(params.allowedMcpServerIds),
        deniedTools: JSON.stringify(params.deniedTools),
        updatedAt: new Date(),
      })
      .where(eq(toolGatewayPolicies.id, existing.id));
    return { policyId: existing.id };
  }

  const id = randomUUID();
  await db.insert(toolGatewayPolicies).values({
    id,
    organizationId: params.organizationId,
    name: "Default",
    allowedTools: JSON.stringify(params.allowedTools),
    allowedMcpServerIds: JSON.stringify(params.allowedMcpServerIds),
    deniedTools: JSON.stringify(params.deniedTools),
    isDefault: true,
  });
  return { policyId: id };
}

export async function listCredentialRefs(organizationId: string) {
  const rows = await db
    .select()
    .from(credentialRefs)
    .where(eq(credentialRefs.organizationId, organizationId))
    .orderBy(desc(credentialRefs.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    envKey: r.envKey,
    description: r.description,
    configured: Boolean((process.env as Record<string, string | undefined>)[r.envKey]),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createCredentialRef(params: {
  organizationId: string;
  userId: string;
  name: string;
  provider: string;
  envKey: string;
  description?: string;
}) {
  // Never accept secret values — only env key names
  if (!/^[A-Z][A-Z0-9_]*$/.test(params.envKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "envKey must be an uppercase env var name (e.g. OPENROUTER_API_KEY)",
    });
  }
  const id = randomUUID();
  await db.insert(credentialRefs).values({
    id,
    organizationId: params.organizationId,
    name: params.name,
    provider: params.provider,
    envKey: params.envKey,
    description: params.description ?? null,
    createdBy: params.userId,
  });
  return {
    id,
    configured: Boolean((process.env as Record<string, string | undefined>)[params.envKey]),
  };
}

export async function listInvocations(organizationId: string, limit = 40) {
  const rows = await db
    .select()
    .from(toolInvocations)
    .where(eq(toolInvocations.organizationId, organizationId))
    .orderBy(desc(toolInvocations.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    toolName: r.toolName,
    status: r.status,
    error: r.error,
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    outputPreview: (() => {
      if (!r.output) return null;
      try {
        const parsed = JSON.parse(r.output);
        return typeof parsed === "string" ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200);
      } catch {
        return r.output.slice(0, 200);
      }
    })(),
  }));
}
