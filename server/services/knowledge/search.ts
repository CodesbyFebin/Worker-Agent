import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../_core/db";
import {
  scripts,
  scriptSections,
  youtubeTrends,
  researchArchive,
  topicTaxonomies,
  winningPatterns,
  brandGuidelines,
} from "../../../drizzle/schema";

export type SearchIndexEntity =
  | "script"
  | "script_section"
  | "trend"
  | "research"
  | "taxonomy"
  | "winning_pattern"
  | "brand_guideline";

export type SearchResult = {
  entityType: SearchIndexEntity;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
};

export async function searchKnowledge(params: {
  organizationId: string;
  query: string;
  entityTypes?: SearchIndexEntity[];
  limit?: number;
}): Promise<SearchResult[]> {
  const term = `%${params.query.replace(/%/g, "\\%")}%`;
  const limit = Math.min(params.limit ?? 25, 100);
  const results: SearchResult[] = [];

  const entityChecks = params.entityTypes ?? [
    "script",
    "script_section",
    "trend",
    "research",
    "taxonomy",
    "winning_pattern",
    "brand_guideline",
  ];

  if (entityChecks.includes("script")) {
    const rows = await db
      .select({
        id: scripts.id,
        title: scripts.title,
        snippet: scripts.fullText,
      })
      .from(scripts)
      .where(
        and(
          eq(scripts.organizationId, params.organizationId),
          or(like(scripts.title, term), like(scripts.fullText, term)),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "script",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 1,
      });
    }
  }

  if (entityChecks.includes("script_section")) {
    const rows = await db
      .select({
        id: scriptSections.id,
        title: scripts.title,
        snippet: scriptSections.content,
      })
      .from(scriptSections)
      .innerJoin(scripts, eq(scripts.id, scriptSections.scriptId))
      .where(
        and(
          eq(scripts.organizationId, params.organizationId),
          like(scriptSections.content, term),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "script_section",
        entityId: r.id,
        title: r.title ?? "Script section",
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.9,
      });
    }
  }

  if (entityChecks.includes("trend")) {
    const rows = await db
      .select({
        id: youtubeTrends.id,
        title: youtubeTrends.query,
        snippet: youtubeTrends.resultsJson,
      })
      .from(youtubeTrends)
      .where(
        and(
          eq(youtubeTrends.organizationId, params.organizationId),
          like(youtubeTrends.query, term),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "trend",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.8,
      });
    }
  }

  if (entityChecks.includes("research")) {
    const rows = await db
      .select({
        id: researchArchive.id,
        title: researchArchive.topic,
        snippet: researchArchive.payload,
      })
      .from(researchArchive)
      .where(
        and(
          eq(researchArchive.organizationId, params.organizationId),
          or(like(researchArchive.topic, term), like(researchArchive.payload, term)),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "research",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.7,
      });
    }
  }

  if (entityChecks.includes("taxonomy")) {
    const rows = await db
      .select({
        id: topicTaxonomies.id,
        title: topicTaxonomies.name,
        snippet: topicTaxonomies.description,
      })
      .from(topicTaxonomies)
      .where(
        and(
          eq(topicTaxonomies.organizationId, params.organizationId),
          or(like(topicTaxonomies.name, term), like(topicTaxonomies.slug, term)),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "taxonomy",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.6,
      });
    }
  }

  if (entityChecks.includes("winning_pattern")) {
    const rows = await db
      .select({
        id: winningPatterns.id,
        title: winningPatterns.contentType,
        snippet: winningPatterns.patternJson,
      })
      .from(winningPatterns)
      .where(
        and(
          eq(winningPatterns.organizationId, params.organizationId),
          like(winningPatterns.topicTags, term),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "winning_pattern",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.5,
      });
    }
  }

  if (entityChecks.includes("brand_guideline")) {
    const rows = await db
      .select({
        id: brandGuidelines.id,
        title: brandGuidelines.name,
        snippet: brandGuidelines.voice,
      })
      .from(brandGuidelines)
      .where(
        and(
          eq(brandGuidelines.organizationId, params.organizationId),
          or(
            like(brandGuidelines.name, term),
            like(brandGuidelines.voice, term),
            like(brandGuidelines.complianceRules, term),
          ),
        ),
      )
      .limit(limit);
    for (const r of rows) {
      results.push({
        entityType: "brand_guideline",
        entityId: r.id,
        title: r.title,
        snippet: (r.snippet ?? "").slice(0, 240),
        score: 0.4,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
