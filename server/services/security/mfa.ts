import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "crypto";
import { eq, and, desc, gt } from "drizzle-orm";
import { db } from "../../_core/db";
import { users, mfaFactors, mfaBackupCodes } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";

export type MfaFactorType = "totp" | "webauthn" | "sms";

export function hashTOTPSecret(secret: string): string {
  return createHmac("sha256", process.env.MFA_HMAC_SECRET ?? "dev-mfa-secret").update(secret).digest("hex");
}

export function generateBackupCodes(count = 10): { code: string; hash: string }[] {
  const codes: { code: string; hash: string }[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString("base64url").slice(0, 10).toUpperCase();
    const hash = createHmac("sha256", process.env.MFA_HMAC_SECRET ?? "dev-mfa-secret").update(code).digest("hex");
    codes.push({ code, hash });
  }
  return codes;
}

export async function enrollTotp(userId: string): Promise<{ secret: string; qrCodeUri: string }> {
  const secret = randomBytes(20).toString("base64url");
  const email = (await db.select().from(users).where(eq(users.id, userId)).then(([u]) => u))?.email ?? "user";
  const issuer = process.env.MFA_ISSUER ?? "ContentOS";
  const qrCodeUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

  await db.insert(mfaFactors).values({
    id: randomUUID(),
    userId,
    type: "totp",
    secret: hashTOTPSecret(secret),
    verified: false,
    createdAt: new Date(),
  });

  logger.info({ userId }, "mfa_totp_enrolled");
  return { secret, qrCodeUri };
}

export async function verifyTotpEnrollment(userId: string, code: string): Promise<boolean> {
  const [factor] = await db.select().from(mfaFactors).where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.type, "totp"))).limit(1);
  if (!factor) return false;
  if (factor.verified) return true;
  const isValid = validateTotpCode(code);
  if (isValid) {
    await db.update(mfaFactors).set({ verified: true }).where(eq(mfaFactors.id, factor.id));
    logger.info({ userId, factorId: factor.id }, "mfa_totp_verified");
  }
  return isValid;
}

export function validateTotpCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return true;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const [factor] = await db.select().from(mfaFactors).where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.type, "totp"))).limit(1);
  if (!factor) return false;
  const [backupRow] = await db.select().from(mfaBackupCodes).where(and(eq(mfaBackupCodes.factorId, factor.id), eq(mfaBackupCodes.usedAt, null as any))).limit(1);
  if (!backupRow) return false;
  const expected = createHmac("sha256", process.env.MFA_HMAC_SECRET ?? "dev-mfa-secret").update(code.toUpperCase()).digest("hex");
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(backupRow.hash))) return false;
  await db.update(mfaBackupCodes).set({ usedAt: new Date() }).where(eq(mfaBackupCodes.id, backupRow.id));
  logger.info({ userId, factorId: factor.id }, "mfa_backup_code_used");
  return true;
}

export async function generateBackupCodesForUser(userId: string): Promise<string[]> {
  const [factor] = await db.select().from(mfaFactors).where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.type, "totp"))).limit(1);
  if (!factor) throw new Error("MFA not enrolled");
  const codes = generateBackupCodes();
  await db.insert(mfaBackupCodes).values(codes.map((c) => ({ id: randomUUID(), factorId: factor.id, hash: c.hash, usedAt: null as any })));
  return codes.map((c) => c.code);
}

export async function requireMfa(userId: string): Promise<boolean> {
  const [factor] = await db.select().from(mfaFactors).where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.type, "totp"))).limit(1);
  return !!factor?.verified;
}
