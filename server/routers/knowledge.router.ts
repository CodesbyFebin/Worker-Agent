import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { SearchIndexEntity } from "../services/knowledge/search";
import { searchKnowledge, searchSimilar, upsertEmbedding } from "../services/knowledge";
import { permissionProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../_core/auth/audit";

const entityTypeEnum = z.enum([
  "script",
  "script_section",
  "trend",
  "research",
  "taxonomy",
  "winning_pattern",
  "brand_guideline",
]);

function requireOrg(ctx: { organizationId: string | null }): string {
  if (!ctx.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active organization — select or create one" });
  }
  return ctx.organizationId;
}

export const knowledgeRouter = router({
  /**
   * Keyword (LIKE) search across scripts, trends, research, taxonomies,
   * winning patterns and brand guidelines — mirrors search.ts.
   */
  search: permissionProcedure("knowledge:read")
    .input(
      z.object({
        query: z.string().min(1).max(1000),
        entityTypes: z.array(entityTypeEnum).max(20).optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = requireOrg(ctx);
      const entityTypes = input.entityTypes as SearchIndexEntity[] | undefined;
      return searchKnowledge({ organizationId, query: input.query, entityTypes, limit: input.limit });
    }),

  /**
   * Semantic (vector) search via cosine similarity over stored embeddings.
   * Uses sentence-transformers when available, else a hash fallback.
   */
  semantic: permissionProcedure("knowledge:read")
    .input(
      z.object({
        query: z.string().min(1).max(1000),
        entityTypes: z.array(z.string()).max(20).optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = requireOrg(ctx);
      return searchSimilar({ organizationId, queryText: input.query, entityTypes: input.entityTypes, limit: input.limit });
    }),

  /**
   * Embed + upsert a knowledge entity so it becomes discoverable via semantic search.
   */
  index: permissionProcedure("knowledge:write")
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string().min(1).max(36),
        text: z.string().min(1).max(25000),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrg(ctx);
      const record = await upsertEmbedding({
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        text: input.text,
        metadata: input.metadata,
      });

      await writeAuditLog({
        organizationId,
        actorUserId: ctx.userId ?? undefined,
        action: "knowledge.embedding.upserted",
        resourceType: "embedding",
        resourceId: record.id,
      });

      return record;
    }),
});
