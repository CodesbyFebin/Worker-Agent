import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../_core/auth/audit";
import {
  addArtifactVersion,
  createArtifact,
  createEvidenceSnapshot,
  getArtifact,
  getEvidenceSnapshot,
  listArtifacts,
  listEvidenceSnapshots,
  readArtifactVersion,
  retrieveEvidence,
  staleSources,
  storageStatus,
} from "../services/artifacts/service";
import { verifyClaim } from "../services/verification/researchProtocol";
import { and, eq } from "drizzle-orm";
import { claimLedger } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const artifactsRouter = router({
  storageStatus: permissionProcedure("artifact:read").query(() => storageStatus()),

  list: permissionProcedure("artifact:read")
    .input(z.object({ claimId: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      return listArtifacts(ctx.organizationId, input);
    }),

  get: permissionProcedure("artifact:read")
    .input(z.object({ artifactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getArtifact(ctx.organizationId, input.artifactId);
    }),

  create: permissionProcedure("artifact:write")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        kind: z.enum(["evidence", "document", "media", "snapshot", "other"]).default("document"),
        contentType: z.string().min(1).max(128).default("text/plain"),
        content: z.string().max(500_000),
        claimId: z.string().uuid().optional(),
        campaignId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createArtifact({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        name: input.name,
        kind: input.kind,
        contentType: input.contentType,
        body: input.content,
        claimId: input.claimId,
        campaignId: input.campaignId,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "artifact.create",
        resourceType: "artifact",
        resourceId: result.artifactId,
        payload: { version: result.version, backend: result.backend },
      });
      return result;
    }),

  addVersion: permissionProcedure("artifact:write")
    .input(
      z.object({
        artifactId: z.string().uuid(),
        content: z.string().max(500_000),
        contentType: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await addArtifactVersion({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        artifactId: input.artifactId,
        body: input.content,
        contentType: input.contentType,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "artifact.version",
        resourceType: "artifact",
        resourceId: result.artifactId,
        payload: { version: result.version },
      });
      return result;
    }),

  readVersion: permissionProcedure("artifact:read")
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return readArtifactVersion(ctx.organizationId, input.versionId);
    }),

  listSnapshots: permissionProcedure("artifact:read")
    .input(z.object({ claimId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listEvidenceSnapshots(ctx.organizationId, input?.claimId);
    }),

  getSnapshot: permissionProcedure("artifact:read")
    .input(z.object({ snapshotId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getEvidenceSnapshot(ctx.organizationId, input.snapshotId);
    }),

  /**
   * Re-verify a claim and freeze an evidence snapshot (+ optional artifact blob).
   */
  captureEvidence: permissionProcedure("artifact:write")
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [claim] = await ctx.db
        .select()
        .from(claimLedger)
        .where(
          and(
            eq(claimLedger.id, input.claimId),
            eq(claimLedger.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });

      const verification = await verifyClaim(claim.claimText);
      await ctx.db
        .update(claimLedger)
        .set({
          verificationStatus: verification.status,
          confidenceScore: String(verification.confidence),
          sourceUrl: verification.topSourceUrl ?? claim.sourceUrl,
        })
        .where(eq(claimLedger.id, claim.id));

      const snap = await createEvidenceSnapshot({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        claimId: claim.id,
        verification,
        storeArtifact: true,
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "evidence.capture",
        resourceType: "evidence_snapshot",
        resourceId: snap.snapshotId,
        payload: { claimId: claim.id, status: verification.status },
      });

      return { ...snap, verification };
    }),

  retrieve: permissionProcedure("artifact:read")
    .input(z.object({ query: z.string().min(1).max(500) }))
    .query(async ({ ctx, input }) => {
      return retrieveEvidence(ctx.organizationId, input.query);
    }),

  staleSources: permissionProcedure("artifact:read")
    .input(z.object({ maxFreshness: z.number().min(0).max(1).default(0.35) }).optional())
    .query(async ({ ctx, input }) => {
      return staleSources(ctx.organizationId, input?.maxFreshness ?? 0.35);
    }),
});
