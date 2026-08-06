import { and, eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { brandGuidelines } from "../../../drizzle/schema";

export type BrandGuidelineRecord = {
  id: string;
  organizationId: string;
  name: string;
  voice: string | null;
  style: string | null;
  terminology: string | null;
  approvedClaims: string | null;
  disallowedClaims: string | null;
  logoUsage: string | null;
  colorPalette: string | null;
  typography: string | null;
  messaging: string | null;
  complianceRules: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function createBrandGuideline(params: {
  organizationId: string;
  name: string;
  voice?: string | null;
  style?: string | null;
  terminology?: string | null;
  approvedClaims?: string | null;
  disallowedClaims?: string | null;
  logoUsage?: string | null;
  colorPalette?: string | null;
  typography?: string | null;
  messaging?: string | null;
  complianceRules?: string | null;
  createdBy: string;
}): Promise<BrandGuidelineRecord> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(brandGuidelines).values({
    id,
    organizationId: params.organizationId,
    name: params.name,
    voice: params.voice ?? null,
    style: params.style ?? null,
    terminology: params.terminology ?? null,
    approvedClaims: params.approvedClaims ?? null,
    disallowedClaims: params.disallowedClaims ?? null,
    logoUsage: params.logoUsage ?? null,
    colorPalette: params.colorPalette ?? null,
    typography: params.typography ?? null,
    messaging: params.messaging ?? null,
    complianceRules: params.complianceRules ?? null,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(brandGuidelines).where(eq(brandGuidelines.id, id)).limit(1);
  if (!row) throw new Error("Failed to load brand guideline after insert");
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBrandGuideline(organizationId: string, guidelineId: string) {
  const [row] = await db
    .select()
    .from(brandGuidelines)
    .where(and(eq(brandGuidelines.id, guidelineId), eq(brandGuidelines.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function listBrandGuidelines(organizationId: string) {
  return db.select().from(brandGuidelines).where(eq(brandGuidelines.organizationId, organizationId));
}

export async function updateBrandGuideline(params: {
  organizationId: string;
  guidelineId: string;
  name?: string;
  voice?: string | null;
  style?: string | null;
  terminology?: string | null;
  approvedClaims?: string | null;
  disallowedClaims?: string | null;
  logoUsage?: string | null;
  colorPalette?: string | null;
  typography?: string | null;
  messaging?: string | null;
  complianceRules?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(brandGuidelines)
    .where(and(eq(brandGuidelines.id, params.guidelineId), eq(brandGuidelines.organizationId, params.organizationId)))
    .limit(1);
  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  const fields = [
    "name",
    "voice",
    "style",
    "terminology",
    "approvedClaims",
    "disallowedClaims",
    "logoUsage",
    "colorPalette",
    "typography",
    "messaging",
    "complianceRules",
  ] as const;
  for (const key of fields) {
    if (params[key] !== undefined) updateData[key] = params[key];
  }

  await db.update(brandGuidelines).set(updateData).where(eq(brandGuidelines.id, params.guidelineId));
  const [updated] = await db.select().from(brandGuidelines).where(eq(brandGuidelines.id, params.guidelineId)).limit(1);
  if (!updated) return null;
  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteBrandGuideline(organizationId: string, guidelineId: string): Promise<boolean> {
  const result = await db
    .delete(brandGuidelines)
    .where(and(eq(brandGuidelines.id, guidelineId), eq(brandGuidelines.organizationId, organizationId)));
  return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0) > 0;
}
