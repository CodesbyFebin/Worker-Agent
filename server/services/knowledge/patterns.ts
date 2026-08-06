import { and, eq, desc } from "drizzle-orm";
import { db } from "../../_core/db";
import { winningPatterns } from "../../../drizzle/schema";

export type WinningPatternRecord = {
  id: string;
  organizationId: string;
  sourceVideoId: string | null;
  sourceScriptId: string | null;
  contentType: string;
  topicTags: string | null;
  patternJson: string;
  performance: string | null;
  createdAt: string;
};

export async function recordWinningPattern(params: {
  organizationId: string;
  contentType: string;
  pattern: Record<string, unknown>;
  performance?: Record<string, unknown> | null;
  sourceVideoId?: string | null;
  sourceScriptId?: string | null;
  topicTags?: string[];
}): Promise<WinningPatternRecord> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(winningPatterns).values({
    id,
    organizationId: params.organizationId,
    contentType: params.contentType,
    patternJson: JSON.stringify(params.pattern),
    performance: params.performance ? JSON.stringify(params.performance) : null,
    sourceVideoId: params.sourceVideoId ?? null,
    sourceScriptId: params.sourceScriptId ?? null,
    topicTags: params.topicTags?.length ? JSON.stringify(params.topicTags) : null,
    createdAt: now,
  });

  const [row] = await db.select().from(winningPatterns).where(eq(winningPatterns.id, id)).limit(1);
  if (!row) throw new Error("Failed to load winning pattern after insert");
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceVideoId: row.sourceVideoId,
    sourceScriptId: row.sourceScriptId,
    contentType: row.contentType,
    topicTags: row.topicTags,
    patternJson: row.patternJson,
    performance: row.performance,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getTopWinningPatterns(params: {
  organizationId: string;
  contentType?: string;
  limit?: number;
}): Promise<WinningPatternRecord[]> {
  const limit = Math.min(params.limit ?? 50, 200);
  const conditions = [eq(winningPatterns.organizationId, params.organizationId)];
  if (params.contentType) {
    conditions.push(eq(winningPatterns.contentType, params.contentType));
  }
  const rows = await db
    .select()
    .from(winningPatterns)
    .where(and(...conditions))
    .orderBy(desc(winningPatterns.createdAt))
    .limit(limit);
  return rows.map((r) => {
    const record = r as typeof winningPatterns.$inferSelect;
    return {
      id: record.id,
      organizationId: record.organizationId,
      sourceVideoId: record.sourceVideoId,
      sourceScriptId: record.sourceScriptId,
      contentType: record.contentType,
      topicTags: record.topicTags,
      patternJson: record.patternJson,
      performance: record.performance,
      createdAt: record.createdAt.toISOString(),
    };
  });
}
