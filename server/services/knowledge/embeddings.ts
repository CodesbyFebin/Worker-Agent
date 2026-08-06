import { and, eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { knowledgeEmbeddings } from "../../../drizzle/schema";
import { recordSecurityEvent } from "../governance/engine";
import { createHash } from "crypto";

export type EmbeddingBackend = "local_sentence_transformers" | "pinecone" | "milvus" | "openai";

export type EmbeddingRecord = {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  embeddingJson: string;
  model: string;
  backend: EmbeddingBackend;
  createdAt: string;
};

export async function upsertEmbedding(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  text: string;
  model?: string;
  backend?: EmbeddingBackend;
  metadata?: Record<string, unknown>;
}): Promise<EmbeddingRecord> {
  const embedding = await computeEmbedding(params.text, params.model);
  const model = params.model ?? "all-MiniLM-L6-v2";
  const backend = params.backend ?? "local_sentence_transformers";
  const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null;
  const embeddingJson = JSON.stringify(embedding);

  const [existing] = await db
    .select()
    .from(knowledgeEmbeddings)
    .where(
      and(
        eq(knowledgeEmbeddings.organizationId, params.organizationId),
        eq(knowledgeEmbeddings.entityType, params.entityType),
        eq(knowledgeEmbeddings.entityId, params.entityId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(knowledgeEmbeddings)
      .set({
        metadata: metadataJson,
        embeddingJson,
        model,
        backend,
      })
      .where(eq(knowledgeEmbeddings.id, existing.id));
    return { ...existing, metadata: metadataJson, embeddingJson, model, backend, createdAt: existing.createdAt.toISOString() };
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(knowledgeEmbeddings).values({
    id,
    organizationId: params.organizationId,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: metadataJson,
    embeddingJson,
    model,
    backend,
    createdAt: now,
  });

  const [row] = await db.select().from(knowledgeEmbeddings).where(eq(knowledgeEmbeddings.id, id)).limit(1);
  if (!row) {
    throw new Error(`Failed to load embedding after insert: ${id}`);
  }

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function searchSimilar(params: {
  organizationId: string;
  queryText: string;
  entityTypes?: string[];
  limit?: number;
}): Promise<Array<{ entityType: string; entityId: string; score: number; metadata: string | null }>> {
  const queryEmbedding = await computeEmbedding(params.queryText);
  const limit = Math.min(params.limit ?? 20, 100);

  const rows = await db
    .select()
    .from(knowledgeEmbeddings)
    .where(eq(knowledgeEmbeddings.organizationId, params.organizationId))
    .limit(500);

  const scored: Array<{ entityType: string; entityId: string; score: number; metadata: string | null }> = [];
  for (const row of rows) {
    if (params.entityTypes?.length && !params.entityTypes.includes(row.entityType)) continue;
    try {
      const stored = JSON.parse(row.embeddingJson) as number[];
      const score = cosineSimilarity(queryEmbedding, stored);
      scored.push({ entityType: row.entityType, entityId: row.entityId, score, metadata: row.metadata });
    } catch {
      // skip malformed
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export async function deleteEmbeddingsForEntity(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
}): Promise<number> {
  const result = await db
    .delete(knowledgeEmbeddings)
    .where(
      and(
        eq(knowledgeEmbeddings.organizationId, params.organizationId),
        eq(knowledgeEmbeddings.entityType, params.entityType),
        eq(knowledgeEmbeddings.entityId, params.entityId),
      ),
    );
  return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
}

async function computeEmbedding(text: string, model = "all-MiniLM-L6-v2"): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) return new Array(384).fill(0);

  try {
    // @ts-ignore - sentence-transformers has no bundled types
    const sentenceTransformers = await import("sentence-transformers");
    const SentenceTransformer = sentenceTransformers.SentenceTransformer as unknown as new (
      modelName: string,
    ) => {
      encode(text: string): number[];
    };
    if (!globalThis.__contentos_embedding_model__) {
      globalThis.__contentos_embedding_model__ = new SentenceTransformer(model);
    }
    const modelInstance = globalThis.__contentos_embedding_model__ as { encode: (t: string) => number[] };
    return modelInstance.encode(trimmed);
  } catch {
    return fallbackEmbedding(trimmed);
  }
}

export function fallbackEmbedding(text: string): number[] {
  const hash = createHash("sha256").update(text).digest();
  const vec = new Array(384).fill(0);
  for (let i = 0; i < hash.length; i++) {
    vec[i % 384] += (hash[i] - 128) / 128;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] as number;
    const bi = b[i] as number;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

declare global {
  var __contentos_embedding_model__: unknown;
}
