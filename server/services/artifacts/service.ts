import { createHash, randomUUID } from "crypto";
import { and, desc, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  artifacts,
  artifactVersions,
  claimLedger,
  evidenceSnapshots,
  evidenceSources,
} from "../../../drizzle/schema";
import { db } from "../../_core/db";
import { getObject, newStorageKey, putObject, storageStatus } from "./objectStore";
import type { ClaimVerificationResult } from "../verification/researchProtocol";

/**
 * Freshness: 1.0 at fetch time, halves every `halfLifeHours` (default 72h).
 * Never invents "live" freshness without a real fetchedAt.
 */
export function freshnessScore(fetchedAt: Date | null | undefined, halfLifeHours = 72): number {
  if (!fetchedAt) return 0;
  const ageMs = Date.now() - fetchedAt.getTime();
  if (ageMs < 0) return 1;
  const ageHours = ageMs / (1000 * 60 * 60);
  return Math.max(0, Math.min(1, Math.pow(0.5, ageHours / halfLifeHours)));
}

export async function createArtifact(params: {
  organizationId: string;
  userId: string;
  name: string;
  kind?: "evidence" | "document" | "media" | "snapshot" | "other";
  contentType: string;
  body: Buffer | string;
  claimId?: string | null;
  campaignId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (params.claimId) {
    const [claim] = await db
      .select({ id: claimLedger.id })
      .from(claimLedger)
      .where(
        and(eq(claimLedger.id, params.claimId), eq(claimLedger.organizationId, params.organizationId)),
      )
      .limit(1);
    if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });
  }

  const artifactId = randomUUID();
  const versionId = randomUUID();
  const stored = await putObject({
    organizationId: params.organizationId,
    keySuffix: newStorageKey(params.name),
    body: params.body,
    contentType: params.contentType,
  });

  await db.insert(artifacts).values({
    id: artifactId,
    organizationId: params.organizationId,
    name: params.name,
    kind: params.kind ?? "other",
    contentType: params.contentType,
    currentVersionId: null,
    claimId: params.claimId ?? null,
    campaignId: params.campaignId ?? null,
    createdBy: params.userId,
  });

  await db.insert(artifactVersions).values({
    id: versionId,
    artifactId,
    organizationId: params.organizationId,
    version: 1,
    storageBackend: stored.backend,
    storageKey: stored.key,
    sizeBytes: stored.sizeBytes,
    checksumSha256: stored.checksumSha256,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdBy: params.userId,
  });

  await db
    .update(artifacts)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId));

  return {
    artifactId,
    versionId,
    version: 1,
    backend: stored.backend,
    checksumSha256: stored.checksumSha256,
    sizeBytes: stored.sizeBytes,
  };
}

export async function addArtifactVersion(params: {
  organizationId: string;
  userId: string;
  artifactId: string;
  body: Buffer | string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}) {
  const [art] = await db
    .select()
    .from(artifacts)
    .where(
      and(eq(artifacts.id, params.artifactId), eq(artifacts.organizationId, params.organizationId)),
    )
    .limit(1);
  if (!art) throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });

  const [latest] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, art.id))
    .orderBy(desc(artifactVersions.version))
    .limit(1);
  const nextVersion = (latest?.version ?? 0) + 1;
  const versionId = randomUUID();
  const contentType = params.contentType ?? art.contentType;

  const stored = await putObject({
    organizationId: params.organizationId,
    keySuffix: newStorageKey(`${art.name}.v${nextVersion}`),
    body: params.body,
    contentType,
  });

  await db.insert(artifactVersions).values({
    id: versionId,
    artifactId: art.id,
    organizationId: params.organizationId,
    version: nextVersion,
    storageBackend: stored.backend,
    storageKey: stored.key,
    sizeBytes: stored.sizeBytes,
    checksumSha256: stored.checksumSha256,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdBy: params.userId,
  });

  await db
    .update(artifacts)
    .set({
      currentVersionId: versionId,
      contentType,
      updatedAt: new Date(),
    })
    .where(eq(artifacts.id, art.id));

  return {
    artifactId: art.id,
    versionId,
    version: nextVersion,
    backend: stored.backend,
    checksumSha256: stored.checksumSha256,
    sizeBytes: stored.sizeBytes,
  };
}

export async function listArtifacts(organizationId: string, opts?: { claimId?: string; limit?: number }) {
  const conditions = [eq(artifacts.organizationId, organizationId)];
  if (opts?.claimId) conditions.push(eq(artifacts.claimId, opts.claimId));
  const rows = await db
    .select()
    .from(artifacts)
    .where(and(...conditions))
    .orderBy(desc(artifacts.updatedAt))
    .limit(opts?.limit ?? 50);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    contentType: r.contentType,
    currentVersionId: r.currentVersionId,
    claimId: r.claimId,
    campaignId: r.campaignId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getArtifact(organizationId: string, artifactId: string) {
  const [art] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.organizationId, organizationId)))
    .limit(1);
  if (!art) throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });

  const versions = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, art.id))
    .orderBy(desc(artifactVersions.version));

  return {
    id: art.id,
    name: art.name,
    kind: art.kind,
    contentType: art.contentType,
    currentVersionId: art.currentVersionId,
    claimId: art.claimId,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      storageBackend: v.storageBackend,
      storageKey: v.storageKey,
      sizeBytes: v.sizeBytes,
      checksumSha256: v.checksumSha256,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

export async function readArtifactVersion(organizationId: string, versionId: string) {
  const [ver] = await db
    .select()
    .from(artifactVersions)
    .where(
      and(eq(artifactVersions.id, versionId), eq(artifactVersions.organizationId, organizationId)),
    )
    .limit(1);
  if (!ver) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
  const obj = await getObject({ backend: ver.storageBackend, key: ver.storageKey });
  return {
    versionId: ver.id,
    artifactId: ver.artifactId,
    version: ver.version,
    checksumSha256: ver.checksumSha256,
    sizeBytes: ver.sizeBytes,
    bodyUtf8: obj.body.toString("utf8"),
    truncated: obj.body.length > 200_000,
  };
}

export async function createEvidenceSnapshot(params: {
  organizationId: string;
  userId: string;
  claimId: string;
  verification: ClaimVerificationResult;
  storeArtifact?: boolean;
}) {
  const [claim] = await db
    .select()
    .from(claimLedger)
    .where(
      and(eq(claimLedger.id, params.claimId), eq(claimLedger.organizationId, params.organizationId)),
    )
    .limit(1);
  if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });

  const snapshotId = randomUUID();
  const fetchedAt = new Date();
  let artifactId: string | null = null;

  if (params.storeArtifact !== false) {
    const blob = JSON.stringify(
      {
        claimId: claim.id,
        claimText: claim.claimText,
        verification: params.verification,
        capturedAt: fetchedAt.toISOString(),
      },
      null,
      2,
    );
    const created = await createArtifact({
      organizationId: params.organizationId,
      userId: params.userId,
      name: `evidence-${claim.devtag}-${fetchedAt.toISOString().slice(0, 10)}.json`,
      kind: "evidence",
      contentType: "application/json",
      body: blob,
      claimId: claim.id,
      metadata: { snapshotId, type: "evidence_snapshot" },
    });
    artifactId = created.artifactId;
  }

  await db.insert(evidenceSnapshots).values({
    id: snapshotId,
    organizationId: params.organizationId,
    claimId: claim.id,
    verificationStatus: params.verification.status,
    confidenceScore:
      params.verification.confidence != null ? String(params.verification.confidence) : null,
    notes: params.verification.notes,
    artifactId,
    createdBy: params.userId,
  });

  const sources = [
    ...params.verification.supportingSentences.map((s) => ({
      url: s.sourceUrl,
      sentence: s.sentence,
      relevance: s.relevanceScore,
      contradict: false,
    })),
    ...params.verification.contradictingSources.map((url) => ({
      url,
      sentence: null as string | null,
      relevance: null as number | null,
      contradict: true,
    })),
  ];

  // Dedupe by URL keeping first
  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    const contentHash = createHash("sha256")
      .update(`${s.url}\n${s.sentence ?? ""}`)
      .digest("hex");
    await db.insert(evidenceSources).values({
      id: randomUUID(),
      organizationId: params.organizationId,
      snapshotId,
      sourceUrl: s.url,
      supportingSentence: s.sentence,
      relevanceScore: s.relevance != null ? String(s.relevance) : null,
      freshnessScore: String(freshnessScore(fetchedAt)),
      httpStatus: 200,
      contentHash,
      fetchedAt,
    });
  }

  // Also record top source if not already present
  if (params.verification.topSourceUrl && !seen.has(params.verification.topSourceUrl)) {
    await db.insert(evidenceSources).values({
      id: randomUUID(),
      organizationId: params.organizationId,
      snapshotId,
      sourceUrl: params.verification.topSourceUrl,
      supportingSentence: null,
      relevanceScore: null,
      freshnessScore: String(freshnessScore(fetchedAt)),
      httpStatus: 200,
      contentHash: createHash("sha256").update(params.verification.topSourceUrl).digest("hex"),
      fetchedAt,
    });
  }

  return { snapshotId, artifactId, sourceCount: seen.size + (params.verification.topSourceUrl && !seen.has(params.verification.topSourceUrl) ? 1 : 0) };
}

export async function listEvidenceSnapshots(organizationId: string, claimId?: string) {
  const conditions = [eq(evidenceSnapshots.organizationId, organizationId)];
  if (claimId) conditions.push(eq(evidenceSnapshots.claimId, claimId));
  const rows = await db
    .select()
    .from(evidenceSnapshots)
    .where(and(...conditions))
    .orderBy(desc(evidenceSnapshots.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    claimId: r.claimId,
    verificationStatus: r.verificationStatus,
    confidenceScore: r.confidenceScore != null ? Number(r.confidenceScore) : null,
    notes: r.notes,
    artifactId: r.artifactId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getEvidenceSnapshot(organizationId: string, snapshotId: string) {
  const [snap] = await db
    .select()
    .from(evidenceSnapshots)
    .where(
      and(
        eq(evidenceSnapshots.id, snapshotId),
        eq(evidenceSnapshots.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!snap) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });

  const sources = await db
    .select()
    .from(evidenceSources)
    .where(eq(evidenceSources.snapshotId, snap.id));

  return {
    id: snap.id,
    claimId: snap.claimId,
    verificationStatus: snap.verificationStatus,
    confidenceScore: snap.confidenceScore != null ? Number(snap.confidenceScore) : null,
    notes: snap.notes,
    artifactId: snap.artifactId,
    createdAt: snap.createdAt.toISOString(),
    sources: sources.map((s) => ({
      id: s.id,
      sourceUrl: s.sourceUrl,
      supportingSentence: s.supportingSentence,
      relevanceScore: s.relevanceScore != null ? Number(s.relevanceScore) : null,
      /** Live recompute from fetchedAt — stored score is at-insert only */
      freshnessScore: freshnessScore(s.fetchedAt),
      storedFreshnessScore: s.freshnessScore != null ? Number(s.freshnessScore) : null,
      httpStatus: s.httpStatus,
      contentHash: s.contentHash,
      fetchedAt: s.fetchedAt?.toISOString() ?? null,
    })),
  };
}

/** Retrieve claims/sources/artifacts by text or URL substring — real DB search. */
export async function retrieveEvidence(organizationId: string, query: string) {
  const q = query.trim();
  if (!q) return { claims: [], sources: [], artifacts: [] };

  const pattern = `%${q}%`;

  const claims = await db
    .select({
      id: claimLedger.id,
      claimText: claimLedger.claimText,
      sourceUrl: claimLedger.sourceUrl,
      verificationStatus: claimLedger.verificationStatus,
      confidenceScore: claimLedger.confidenceScore,
    })
    .from(claimLedger)
    .where(
      and(
        eq(claimLedger.organizationId, organizationId),
        or(like(claimLedger.claimText, pattern), like(claimLedger.sourceUrl, pattern)),
      ),
    )
    .limit(20);

  const sources = await db
    .select({
      id: evidenceSources.id,
      sourceUrl: evidenceSources.sourceUrl,
      supportingSentence: evidenceSources.supportingSentence,
      snapshotId: evidenceSources.snapshotId,
      fetchedAt: evidenceSources.fetchedAt,
    })
    .from(evidenceSources)
    .where(
      and(
        eq(evidenceSources.organizationId, organizationId),
        or(
          like(evidenceSources.sourceUrl, pattern),
          like(evidenceSources.supportingSentence, pattern),
        ),
      ),
    )
    .limit(20);

  const arts = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.organizationId, organizationId), like(artifacts.name, pattern)))
    .limit(20);

  return {
    claims: claims.map((c) => ({
      ...c,
      confidenceScore: c.confidenceScore != null ? Number(c.confidenceScore) : null,
    })),
    sources: sources.map((s) => ({
      ...s,
      freshnessScore: freshnessScore(s.fetchedAt),
      fetchedAt: s.fetchedAt?.toISOString() ?? null,
    })),
    artifacts: arts.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      claimId: a.claimId,
    })),
  };
}

export async function staleSources(organizationId: string, maxFreshness = 0.35) {
  const rows = await db
    .select()
    .from(evidenceSources)
    .where(eq(evidenceSources.organizationId, organizationId))
    .orderBy(desc(evidenceSources.fetchedAt))
    .limit(200);

  return rows
    .map((s) => ({
      id: s.id,
      sourceUrl: s.sourceUrl,
      snapshotId: s.snapshotId,
      freshnessScore: freshnessScore(s.fetchedAt),
      fetchedAt: s.fetchedAt?.toISOString() ?? null,
    }))
    .filter((s) => s.freshnessScore < maxFreshness)
    .slice(0, 50);
}

export { storageStatus };
