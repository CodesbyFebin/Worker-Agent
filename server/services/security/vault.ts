import { randomUUID } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../_core/db";
import { credentialRefs, vaultSecrets } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";

export type VaultProvider = "hashicorp" | "doppler" | "env";

export async function writeSecret(input: {
  organizationId: string;
  name: string;
  provider: VaultProvider;
  path: string;
  encryptedValue: string;
  createdBy: string;
  expiresAt?: Date;
}): Promise<typeof vaultSecrets.$inferSelect> {
  const record = await db.insert(vaultSecrets).values({
    id: randomUUID(),
    organizationId: input.organizationId,
    name: input.name,
    provider: input.provider,
    path: input.path,
    encryptedValue: input.encryptedValue,
    version: 1,
    createdBy: input.createdBy,
    expiresAt: input.expiresAt ?? null,
    createdAt: new Date(),
  }).then(([r]) => r as unknown as typeof vaultSecrets.$inferSelect);

  logger.info({ vaultSecretId: record.id, provider: input.provider }, "vault_secret_written");
  return record;
}

export async function readSecret(secretId: string): Promise<typeof vaultSecrets.$inferSelect | null> {
  const [row] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, secretId)).limit(1);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

export async function listSecrets(organizationId: string) {
  return db.select().from(vaultSecrets).where(eq(vaultSecrets.organizationId, organizationId)).orderBy(desc(vaultSecrets.createdAt));
}

export async function revokeSecret(secretId: string): Promise<void> {
  await db.update(vaultSecrets).set({ revokedAt: new Date() }).where(eq(vaultSecrets.id, secretId));
  logger.info({ secretId }, "vault_secret_revoked");
}

export async function syncCredentialRefToVault(credentialId: string): Promise<void> {
  const [cred] = await db.select().from(credentialRefs).where(eq(credentialRefs.id, credentialId)).limit(1);
  if (!cred) return;
  const envValue = process.env[cred.envKey];
  if (!envValue) {
    logger.warn({ credentialId, envKey: cred.envKey }, "vault_sync_missing_env");
    return;
  }
  const encrypted = Buffer.from(envValue).toString("base64");
  await writeSecret({
    organizationId: cred.organizationId,
    name: cred.name,
    provider: "env",
    path: `env://${cred.envKey}`,
    encryptedValue: encrypted,
    createdBy: cred.createdBy ?? "system",
  });
  logger.info({ credentialId }, "vault_sync_completed");
}
