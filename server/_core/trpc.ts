import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import type { PermissionKey } from "./auth/permissions";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a valid session (authenticated user). */
export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.sessionId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    },
  });
});

/**
 * Requires authenticated user + active organization membership.
 * Prefer this for all tenant-scoped domain APIs.
 */
export const organizationProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.sessionId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization — select or create an organization",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      organizationId: ctx.organizationId,
      permissions: ctx.permissions,
      roleSlug: ctx.roleSlug,
    },
  });
});

/** Requires a specific permission key within the active organization. */
export function permissionProcedure(permission: PermissionKey) {
  return organizationProcedure.use(({ ctx, next }) => {
    if (!ctx.permissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }
    return next({ ctx });
  });
}

/**
 * @deprecated Prefer `organizationProcedure` / `permissionProcedure`.
 * Kept as an alias so existing routers compile while being migrated.
 */
export const protectedProcedure = organizationProcedure;
