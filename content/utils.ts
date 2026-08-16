import type { ContentRecord, EvidenceKind } from "./types.js";

const canonicalHost = "https://workeragent.cloud/";

export function createContentRecord(record: ContentRecord): ContentRecord {
  if (!record.slug || !record.title || !record.pillarId || !record.clusterId) {
    throw new Error(`Invalid content record: ${record.slug || record.title || "unknown"}`);
  }

  if (record.slug.startsWith("/") || record.slug.endsWith("/")) {
    throw new Error(`Content slug must not start or end with '/': ${record.slug}`);
  }

  if (record.canonicalUrl && !record.canonicalUrl.startsWith(canonicalHost)) {
    throw new Error(`Canonical must stay on workeragent.cloud until domain policy changes: ${record.slug}`);
  }

  return record;
}

export function hasRequiredEvidence(page: ContentRecord): boolean {
  const kinds = new Set<EvidenceKind>(page.evidence.map((item) => item.kind));
  return page.requiredEvidence.every((kind) => kinds.has(kind));
}

export function isContentIndexable(page: ContentRecord): boolean {
  return (
    page.publicationStatus === "published" &&
    page.reviewStatus === "approved" &&
    page.evidenceStatus === "verified" &&
    page.hasUniqueUserValue === true &&
    page.canonicalUrl !== null &&
    page.rendering === "static-html" &&
    page.evidence.length > 0 &&
    hasRequiredEvidence(page) &&
    page.lastReviewed !== null
  );
}
