import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "../../drizzle/schema";

/**
 * Replace `resolveUserIdFromRequest` with your real auth (session cookie,
 * JWT, Clerk/Auth.js, etc). Left explicit here so it's obvious where to
 * wire it in rather than hiding it behind a library default.
 *
 * Until real auth lands, the client sends `x-user-id`. We still upsert a
 * real `users` row so FK constraints on scripts/campaigns succeed — this is
 * not a fake user record presented as an auth system; it's the minimal
 * stand-in documented in schema.ts ("replace with your real auth").
 */
function resolveUserIdFromRequest(req: CreateExpressContextOptions["req"]): string | null {
  const header = req.headers["x-user-id"];
  return typeof header === "string" && header.trim().length > 0 ? header.trim() : null;
}

async function ensureUserRow(userId: string): Promise<void> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (existing) return;
  await db.insert(users).values({
    id: userId,
    email: `${userId}@local.dev`,
  });
}

export async function createContext({ req }: CreateExpressContextOptions) {
  const userId = resolveUserIdFromRequest(req);
  if (userId) {
    await ensureUserRow(userId);
  }
  return {
    db,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
