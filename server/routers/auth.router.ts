import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  authenticatedProcedure,
  permissionProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import { organizationMembers, organizations, roles, sessions } from "../../drizzle/schema";
import { clearSessionCookie, createSession, devLogin, parseCookies, revokeSessionByToken, setSessionCookie } from "../_core/auth/session";
import { SESSION_COOKIE } from "../_core/auth/permissions";
import { env } from "../_core/env";
import { writeAuditLog } from "../_core/auth/audit";

export const authRouter = router({
  /**
   * Development-only login. Creates/uses a local user, personal org, and
   * httpOnly session cookie. Disabled when NODE_ENV=production.
   */
  devLogin: publicProcedure
    .input(
      z
        .object({
          email: z.string().email().optional(),
          displayName: z.string().min(1).max(255).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Development login is disabled in production",
        });
      }
      const result = await devLogin({
        email: input?.email,
        displayName: input?.displayName,
        userAgent: ctx.req.headers["user-agent"],
        res: ctx.res,
      });
      return {
        ...result,
        developmentOnly: true as const,
      };
    }),

  logout: authenticatedProcedure.mutation(async ({ ctx }) => {
    const cookies = parseCookies(ctx.req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) await revokeSessionByToken(token);
    clearSessionCookie(ctx.res);
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "auth.logout",
      resourceType: "session",
      resourceId: ctx.sessionId,
    });
    return { ok: true as const };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.sessionId) return null;
    const memberships = await ctx.db
      .select({
        organizationId: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        roleSlug: roles.slug,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .where(eq(organizationMembers.userId, ctx.userId));

    return {
      userId: ctx.userId,
      email: ctx.userEmail,
      displayName: ctx.userDisplayName,
      sessionId: ctx.sessionId,
      organizationId: ctx.organizationId,
      organizationName: ctx.organizationName,
      roleSlug: ctx.roleSlug,
      permissions: ctx.permissions,
      organizations: memberships,
      developmentAuth: env.NODE_ENV !== "production",
    };
  }),

  listOrganizations: authenticatedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        roleSlug: roles.slug,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .where(eq(organizationMembers.userId, ctx.userId));
    return rows;
  }),

  /** Switch active organization for the current session (must be a member). */
  switchOrganization: authenticatedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, ctx.userId),
            eq(organizationMembers.organizationId, input.organizationId),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of that organization" });
      }

      await ctx.db
        .update(sessions)
        .set({ organizationId: input.organizationId, lastSeenAt: new Date() })
        .where(eq(sessions.id, ctx.sessionId));

      // Refresh cookie expiry by issuing a new session token bound to the org.
      const cookies = parseCookies(ctx.req.headers.cookie);
      const oldToken = cookies[SESSION_COOKIE];
      if (oldToken) await revokeSessionByToken(oldToken);

      const fresh = await createSession({
        userId: ctx.userId,
        organizationId: input.organizationId,
        userAgent: ctx.req.headers["user-agent"],
      });
      setSessionCookie(ctx.res, fresh.token, fresh.expiresAt);

      await writeAuditLog({
        organizationId: input.organizationId,
        actorUserId: ctx.userId,
        action: "auth.switch_organization",
        resourceType: "organization",
        resourceId: input.organizationId,
      });

      return { organizationId: input.organizationId, sessionId: fresh.sessionId };
    }),

  listAuditLog: permissionProcedure("audit:read")
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const { auditLogs } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await ctx.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, ctx.organizationId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(input?.limit ?? 50);
      return rows.map((r) => ({
        ...r,
        payload: r.payload ? (JSON.parse(r.payload) as unknown) : null,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  /** Team roster for the active org. */
  listMembers: permissionProcedure("org:members").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        membershipId: organizationMembers.id,
        userId: organizationMembers.userId,
        roleSlug: roles.slug,
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .where(eq(organizationMembers.organizationId, ctx.organizationId));

    const { users } = await import("../../drizzle/schema");
    const enriched = [];
    for (const row of rows) {
      const [u] = await ctx.db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      enriched.push({
        ...row,
        email: u?.email ?? null,
        displayName: u?.displayName ?? null,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return enriched;
  }),
});
