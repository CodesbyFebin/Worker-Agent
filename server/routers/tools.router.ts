import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { permissionProcedure, router } from "../_core/trpc";
import { mcpServers, toolGatewayPolicies } from "../../drizzle/schema";
import { writeAuditLog } from "../_core/auth/audit";
import {
  createCredentialRef,
  discoverMcpServer,
  ensureBuiltinToolsSeeded,
  invokeTool,
  listCredentialRefs,
  listDiscoverableTools,
  listInvocations,
  registerMcpServer,
  upsertDefaultPolicy,
} from "../services/tools/gateway";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const toolsRouter = router({
  list: permissionProcedure("tool:invoke").query(async ({ ctx }) => {
    return listDiscoverableTools(ctx.organizationId);
  }),

  listInvocations: permissionProcedure("tool:invoke")
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      return listInvocations(ctx.organizationId, input?.limit ?? 40);
    }),

  invoke: permissionProcedure("tool:invoke")
    .input(
      z.object({
        toolName: z.string().min(1).max(255),
        input: z.record(z.unknown()).default({}),
        agentExecutionId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return invokeTool({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        permissions: ctx.permissions,
        toolName: input.toolName,
        input: input.input,
        agentExecutionId: input.agentExecutionId,
      });
    }),

  listMcpServers: permissionProcedure("tool:invoke").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.organizationId, ctx.organizationId))
      .orderBy(desc(mcpServers.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      transport: r.transport,
      endpoint: r.endpoint,
      enabled: r.enabled,
      lastDiscoveredAt: r.lastDiscoveredAt?.toISOString() ?? null,
      lastError: r.lastError,
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  registerMcpServer: permissionProcedure("mcp:manage")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        transport: z.enum(["http", "stdio"]),
        endpoint: z.string().min(1).max(4000),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await registerMcpServer({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "mcp.register",
        resourceType: "mcp_server",
        resourceId: result.serverId,
        payload: { name: input.name, transport: input.transport },
      });
      return result;
    }),

  discoverMcp: permissionProcedure("mcp:manage")
    .input(z.object({ serverId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await discoverMcpServer(ctx.organizationId, input.serverId);
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "mcp.discover",
        resourceType: "mcp_server",
        resourceId: input.serverId,
        payload: result,
      });
      return result;
    }),

  setMcpEnabled: permissionProcedure("mcp:manage")
    .input(z.object({ serverId: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(mcpServers)
        .where(
          and(eq(mcpServers.id, input.serverId), eq(mcpServers.organizationId, ctx.organizationId)),
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });
      await ctx.db
        .update(mcpServers)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(mcpServers.id, input.serverId));
      return { ok: true as const };
    }),

  getPolicy: permissionProcedure("tool:invoke").query(async ({ ctx }) => {
    const [policy] = await ctx.db
      .select()
      .from(toolGatewayPolicies)
      .where(
        and(
          eq(toolGatewayPolicies.organizationId, ctx.organizationId),
          eq(toolGatewayPolicies.isDefault, true),
        ),
      )
      .limit(1);
    if (!policy) {
      return {
        policyId: null,
        allowedTools: [] as string[],
        allowedMcpServerIds: [] as string[],
        deniedTools: [] as string[],
      };
    }
    return {
      policyId: policy.id,
      allowedTools: parseJson<string[]>(policy.allowedTools, []),
      allowedMcpServerIds: parseJson<string[]>(policy.allowedMcpServerIds, []),
      deniedTools: parseJson<string[]>(policy.deniedTools, []),
    };
  }),

  setPolicy: permissionProcedure("tool:manage")
    .input(
      z.object({
        allowedTools: z.array(z.string()).max(200),
        allowedMcpServerIds: z.array(z.string().uuid()).max(100),
        deniedTools: z.array(z.string()).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await upsertDefaultPolicy({
        organizationId: ctx.organizationId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "tool.policy_update",
        resourceType: "tool_policy",
        resourceId: result.policyId,
        payload: input,
      });
      return result;
    }),

  listCredentials: permissionProcedure("tool:invoke").query(async ({ ctx }) => {
    return listCredentialRefs(ctx.organizationId);
  }),

  createCredential: permissionProcedure("tool:manage")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        provider: z.string().min(1).max(64),
        envKey: z.string().min(1).max(128),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createCredentialRef({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...input,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "credential.create",
        resourceType: "credential_ref",
        resourceId: result.id,
        payload: { provider: input.provider, envKey: input.envKey },
      });
      return result;
    }),

  seedBuiltins: permissionProcedure("tool:manage").mutation(async () => {
    await ensureBuiltinToolsSeeded();
    return { ok: true as const };
  }),
});
