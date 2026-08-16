import { access } from "node:fs/promises";
import path from "node:path";
import type { ContentRecord } from "./types.js";
import { hasRequiredEvidence, isContentIndexable } from "./utils.js";

export async function collectPublicationViolations(records: ContentRecord[]): Promise<string[]> {
  const violations: string[] = [];
  const slugs = new Set<string>();
  const canonicals = new Set<string>();
  const recordBySlug = new Map(records.map((record) => [record.slug, record]));

  for (const page of records) {
    if (slugs.has(page.slug)) violations.push(`Duplicate slug: ${page.slug}`);
    slugs.add(page.slug);

    if (page.canonicalUrl) {
      if (canonicals.has(page.canonicalUrl)) violations.push(`Duplicate canonical URL: ${page.canonicalUrl}`);
      canonicals.add(page.canonicalUrl);
    }

    if (page.publicationStatus === "published") {
      if (page.reviewStatus !== "approved") violations.push(`${page.slug}: published without approved review`);
      if (page.evidenceStatus !== "verified") violations.push(`${page.slug}: published without verified evidence`);
      if (!page.canonicalUrl) violations.push(`${page.slug}: published without canonical URL`);
      if (page.rendering !== "static-html") violations.push(`${page.slug}: published indexable content must use static-html rendering`);
      if (!page.hasUniqueUserValue) violations.push(`${page.slug}: published without unique-user-value gate`);
      if (!page.lastReviewed) violations.push(`${page.slug}: published without lastReviewed`);
      if (page.evidence.length === 0) violations.push(`${page.slug}: published without evidence references`);
      if (!hasRequiredEvidence(page)) violations.push(`${page.slug}: required evidence kinds are not satisfied`);
    }

    if (page.riskLevel === "high" && page.publicationStatus === "published") {
      const strongKinds = new Set(page.evidence.map((item) => item.kind));
      if (!strongKinds.has("risk-framework")) violations.push(`${page.slug}: high-risk page requires a risk-framework source`);
      if (!page.lastReviewed) violations.push(`${page.slug}: high-risk page requires lastReviewed`);
    }

    for (const evidence of page.evidence) {
      if (!/^https:\/\//.test(evidence.url)) violations.push(`${page.slug}: evidence URL must use HTTPS (${evidence.id})`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.lastChecked)) violations.push(`${page.slug}: invalid evidence lastChecked (${evidence.id})`);
      if (evidence.supports.length === 0) violations.push(`${page.slug}: evidence must declare what it supports (${evidence.id})`);
    }

    for (const related of page.relatedPages) {
      if (!recordBySlug.has(related)) violations.push(`${page.slug}: related page is missing from manifest (${related})`);
    }

    if (isContentIndexable(page)) {
      try {
        await access(path.resolve(page.contentFile));
      } catch {
        violations.push(`${page.slug}: indexable page content file does not exist (${page.contentFile})`);
      }
    }
  }

  return violations;
}

export async function validateContentManifest(records: ContentRecord[]): Promise<void> {
  const violations = await collectPublicationViolations(records);
  if (violations.length > 0) {
    throw new Error(`Publication Gate Failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  }
}
