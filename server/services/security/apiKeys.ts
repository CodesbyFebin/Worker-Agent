import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../_core/db";
import { users, apiKeys } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";

const API_KEY_PREFIX = "cos_";
const API_KEY_PREFIX_LENGTH = API_KEY_PREFIX.length;
const SECRET_LENGTH = 32;

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = API_KEY_PREFIX + randomBytes(SECRET_LENGTH).toString("base64url");
  const prefix = raw.slice(0, API_KEY_PREFIX_LENGTH + 8);
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHmac("sha256", process.env.API_KEY_HMAC_SECRET ?? "dev-api-key-secret").update(raw).digest("hex");
}

export function verifyApiKey(raw: string, hash: string): boolean {
  const expected = hashApiKey(raw);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}

export async function createApiKey(input: {
  userId: string;
  organizationId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date;
}): Promise<{ record: ApiKeyRecord; raw: string }> {
  const { raw, prefix, hash } = generateApiKey();
  const record = await db.insert(apiKeys).values({
    id: randomUUID(),
    userId: input.userId,
    organizationId: input.organizationId,
    name: input.name,
    prefix,
    hash,
    scopes: JSON.stringify(input.scopes),
    expiresAt: input.expiresAt ?? null,
    lastRotatedAt: new Date(),
    createdAt: new Date(),
  }).then(([r]) => r as ApiKeyRecord);

  logger.info({ apiKeyId: record.id, userId: input.userId }, "api_key_created");
  return { record, raw };
}

export async function validateApiKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw.startsWith(API_KEY_PREFIX)) return null;
  const prefix = raw.slice(0, API_KEY_PREFIX_LENGTH + 8);
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.prefix, prefix)).limit(1);
  if (!key || !verifyApiKey(raw, key.hash)) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return key;
}

export async function rotateApiKey(keyId: string): Promise<{ raw: string } | null> {
  const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  if (!existing) return null;
  const { raw, hash, prefix } = generateApiKey();
  await db.update(apiKeys).set({ hash, prefix, lastRotatedAt: new Date() }).where(eq(apiKeys.id, keyId));
  logger.info({ apiKeyId: keyId }, "api_key_rotated");
  return { raw };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
  logger.info({ apiKeyId: keyId }, "api_key_revoked");
}

export async function listApiKeys(userId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}
