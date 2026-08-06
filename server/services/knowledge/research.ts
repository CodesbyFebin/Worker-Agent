import { and, eq, desc } from "drizzle-orm";
import { db } from "../../_core/db";
import { researchArchive } from "../../../drizzle/schema";

export type ResearchRecord = {
  id: string;
  organizationId: string;
  topic: string;
  source: string;
  payload: string;
  confidenceScore: number | null;
  createdAt: string;
};

export async function archiveResearch(params: {
  organizationId: string;
  topic: string;
  source: string;
  payload: Record<string, unknown>;
  confidenceScore?: number | null;
}): Promise<ResearchRecord> {
  const id = crypto.randomUUID();
  const now = new Date();
  const confidenceScore = params.confidenceScore ?? null;
  await db.insert(researchArchive).values({
    id,
    organizationId: params.organizationId,
    topic: params.topic,
    source: params.source,
    payload: JSON.stringify(params.payload),
    confidenceScore: confidenceScore as any,
    createdAt: now,
  });

  const [row] = await db.select().from(researchArchive).where(eq(researchArchive.id, id)).limit(1);
  if (!row) throw new Error("Failed to load research after insert");
  return {
    id: row.id,
    organizationId: row.organizationId,
    topic: row.topic,
    source: row.source,
    payload: row.payload,
    confidenceScore: row.confidenceScore ? Number(row.confidenceScore) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getResearchHistory(params: {
  organizationId: string;
  topic?: string;
  source?: string;
  limit?: number;
}): Promise<ResearchRecord[]> {
  const limit = Math.min(params.limit ?? 100, 500);
  const conditions = [eq(researchArchive.organizationId, params.organizationId)];
  if (params.topic) {
    conditions.push(eq(researchArchive.topic, params.topic));
  }
  if (params.source) {
    conditions.push(eq(researchArchive.source, params.source));
  }
  const rows = await db
    .select()
    .from(researchArchive)
    .where(and(...conditions))
    .orderBy(desc(researchArchive.createdAt))
    .limit(limit);
  return rows.map((r) => {
    const record = r as typeof researchArchive.$inferSelect;
    return {
      id: record.id,
      organizationId: record.organizationId,
      topic: record.topic,
      source: record.source,
      payload: record.payload,
      confidenceScore: record.confidenceScore ? Number(record.confidenceScore) : null,
      createdAt: record.createdAt.toISOString(),
    };
  });
}
