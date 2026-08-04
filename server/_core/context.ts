import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { organizationMembers, organizations, roles, users } from "../../drizzle/schema";
import { ORG_HEADER } from "./auth/permissions";
import { loadPermissionsForRole } from "./auth/bootstrap";
import { parseCookies, resolveSession } from "./auth/session";
import { SESSION_COOKIE } from "./auth/permissions";

export type AuthContext = {
  db: typeof db;
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  roleSlug: string | null;
  permissions: string[];
  sessionId: string | null;
};

/**
 * Resolves identity from a real httpOnly session cookie only.
 * Never trusts a raw `x-user-id` header — that stand-in is removed.
 * Optional `x-organization-id` switches active org when the user is a member.
 */
export async function createContext({ req, res }: CreateExpressContextOptions): Promise<AuthContext> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  const base: AuthContext = {
    db,
    req,
    res,
    userId: null,
    userEmail: null,
    userDisplayName: null,
    organizationId: null,
    organizationName: null,
    roleSlug: null,
    permissions: [],
    sessionId: null,
  };

  if (!token) return base;

  const session = await resolveSession(token);
  if (!session) return base;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return base;

  const headerOrg = req.headers[ORG_HEADER];
  const requestedOrgId =
    typeof headerOrg === "string" && headerOrg.trim().length > 0 ? headerOrg.trim() : session.organizationId;

  const [membership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
      roleId: organizationMembers.roleId,
      roleSlug: roles.slug,
      organizationName: organizations.name,
    })
    .from(organizationMembers)
    .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.organizationId, requestedOrgId),
      ),
    )
    .limit(1);

  // Fall back to session org if requested org is not a membership.
  let active = membership;
  if (!active && requestedOrgId !== session.organizationId) {
    const [fallback] = await db
      .select({
        organizationId: organizationMembers.organizationId,
        roleId: organizationMembers.roleId,
        roleSlug: roles.slug,
        organizationName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    active = fallback;
  }

  if (!active) {
    return {
      ...base,
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      sessionId: session.sessionId,
    };
  }

  const perms = await loadPermissionsForRole(active.roleId);

  return {
    ...base,
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName,
    organizationId: active.organizationId,
    organizationName: active.organizationName,
    roleSlug: active.roleSlug,
    permissions: perms,
    sessionId: session.sessionId,
  };
}

export type Context = AuthContext;
