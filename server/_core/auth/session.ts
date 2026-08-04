import { createHash, randomBytes, randomUUID } from "crypto";
import type { Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { organizationMembers, organizations, sessions, users } from "../../../drizzle/schema";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./permissions";
import { ensureSystemRoles, getSystemRoleId } from "./bootstrap";
import { writeAuditLog } from "./audit";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  );
}

export function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export async function createSession(params: {
  userId: string;
  organizationId: string;
  userAgent?: string | null;
}): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sessionId,
    tokenHash: hashToken(token),
    userId: params.userId,
    organizationId: params.organizationId,
    expiresAt,
    revokedAt: null,
    createdAt: new Date(),
    lastSeenAt: new Date(),
    userAgent: params.userAgent?.slice(0, 512) ?? null,
  });
  return { sessionId, token, expiresAt };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)));
}

export async function resolveSession(token: string): Promise<{
  sessionId: string;
  userId: string;
  organizationId: string;
} | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.id));
  return {
    sessionId: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
  };
}

export async function ensurePersonalOrganization(params: {
  userId: string;
  email: string;
  displayName?: string;
}): Promise<{ organizationId: string }> {
  await ensureSystemRoles();

  const [existingMember] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, params.userId))
    .limit(1);

  if (existingMember) {
    return { organizationId: existingMember.organizationId };
  }

  const organizationId = randomUUID();
  const slugBase = params.email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${slugBase || "org"}-${organizationId.slice(0, 8)}`;

  await db.insert(organizations).values({
    id: organizationId,
    name: params.displayName ? `${params.displayName}'s workspace` : "Personal workspace",
    slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const ownerRoleId = await getSystemRoleId("owner");
  await db.insert(organizationMembers).values({
    id: randomUUID(),
    organizationId,
    userId: params.userId,
    roleId: ownerRoleId,
    createdAt: new Date(),
  });

  return { organizationId };
}

/**
 * Development-only sign-in: upserts a local user, ensures a personal org,
 * and issues a real httpOnly session cookie. Not available in production.
 */
export async function devLogin(params: {
  email?: string;
  displayName?: string;
  userAgent?: string | null;
  res: Response;
}): Promise<{
  userId: string;
  email: string;
  organizationId: string;
  sessionId: string;
}> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development login is disabled in production");
  }

  const email = (params.email?.trim() || "local-dev-user@local.dev").toLowerCase();
  const displayName = params.displayName?.trim() || "Local Dev User";

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      displayName,
      createdAt: new Date(),
    });
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  } else if (!user.displayName && displayName) {
    await db.update(users).set({ displayName }).where(eq(users.id, user.id));
  }

  if (!user) throw new Error("Failed to create development user");

  const { organizationId } = await ensurePersonalOrganization({
    userId: user.id,
    email: user.email,
    displayName: user.displayName ?? displayName,
  });

  const session = await createSession({
    userId: user.id,
    organizationId,
    userAgent: params.userAgent,
  });
  setSessionCookie(params.res, session.token, session.expiresAt);

  await writeAuditLog({
    organizationId,
    actorUserId: user.id,
    action: "auth.dev_login",
    resourceType: "session",
    resourceId: session.sessionId,
  });

  return {
    userId: user.id,
    email: user.email,
    organizationId,
    sessionId: session.sessionId,
  };
}
