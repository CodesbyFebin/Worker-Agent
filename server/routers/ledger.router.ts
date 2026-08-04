import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { claimLedger, scripts } from "../../drizzle/schema";
import { extractClaims } from "../services/verification/claimValidator";
import { verifyClaim } from "../services/verification/researchProtocol";

function mapClaim(row: typeof claimLedger.$inferSelect) {
  return {
    ...row,
    confidenceScore: row.confidenceScore ? Number(row.confidenceScore) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const ledgerRouter = router({
  listByScript: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [script] = await ctx.db
        .select({ id: scripts.id })
        .from(scripts)
        .where(and(eq(scripts.id, input.scriptId), eq(scripts.organizationId, ctx.organizationId)))
        .limit(1);
      if (!script) throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });

      const rows = await ctx.db
        .select()
        .from(claimLedger)
        .where(
          and(eq(claimLedger.scriptId, input.scriptId), eq(claimLedger.organizationId, ctx.organizationId)),
        )
        .orderBy(desc(claimLedger.createdAt));

      return rows.map(mapClaim);
    }),

  /**
   * Recent claims across scripts — powers Mission Control activity feed + table.
   * Optional scriptId scopes the view; no invented rows.
   */
  listRecent: protectedProcedure
    .input(
      z.object({
        scriptId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = input.scriptId
        ? await ctx.db
            .select({
              claim: claimLedger,
              scriptTitle: scripts.title,
            })
            .from(claimLedger)
            .leftJoin(scripts, eq(claimLedger.scriptId, scripts.id))
            .where(
              and(
                eq(claimLedger.scriptId, input.scriptId),
                eq(claimLedger.organizationId, ctx.organizationId),
              ),
            )
            .orderBy(desc(claimLedger.createdAt))
            .limit(input.limit)
        : await ctx.db
            .select({
              claim: claimLedger,
              scriptTitle: scripts.title,
            })
            .from(claimLedger)
            .leftJoin(scripts, eq(claimLedger.scriptId, scripts.id))
            .where(eq(claimLedger.organizationId, ctx.organizationId))
            .orderBy(desc(claimLedger.createdAt))
            .limit(input.limit);

      return rows.map(({ claim, scriptTitle }) => ({
        ...mapClaim(claim),
        scriptTitle: scriptTitle ?? null,
      }));
    }),

  /**
   * Aggregates from claim_ledger only — counts, avg confidence, today count,
   * hourly buckets for today. No fabricated growth percentages.
   */
  summary: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scriptId = input?.scriptId;
      const all = scriptId
        ? await ctx.db
            .select()
            .from(claimLedger)
            .where(
              and(eq(claimLedger.scriptId, scriptId), eq(claimLedger.organizationId, ctx.organizationId)),
            )
        : await ctx.db
            .select()
            .from(claimLedger)
            .where(eq(claimLedger.organizationId, ctx.organizationId));

      const byStatus = {
        pending: 0,
        verified: 0,
        rejected: 0,
        unverifiable: 0,
      };
      let confidenceSum = 0;
      let confidenceN = 0;
      let withSource = 0;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const hourlyToday = Array.from({ length: 24 }, () => 0);
      let todayCount = 0;

      for (const row of all) {
        const st = row.verificationStatus as keyof typeof byStatus;
        if (st in byStatus) byStatus[st] += 1;
        if (row.confidenceScore != null) {
          confidenceSum += Number(row.confidenceScore);
          confidenceN += 1;
        }
        if (row.sourceUrl) withSource += 1;
        if (row.createdAt >= startOfDay) {
          todayCount += 1;
          hourlyToday[row.createdAt.getHours()] += 1;
        }
      }

      const total = all.length;
      const resolved = byStatus.verified + byStatus.rejected + byStatus.unverifiable;
      const verificationRate = resolved > 0 ? byStatus.verified / resolved : null;

      return {
        total,
        todayCount,
        withSource,
        byStatus,
        avgConfidence: confidenceN > 0 ? confidenceSum / confidenceN : null,
        verificationRate,
        hourlyToday,
        asOf: new Date().toISOString(),
      };
    }),

  /**
   * Runs the claim extractor over a block of text and logs each checkable
   * claim as a pending ledger entry.
   */
  extractAndLog: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid(), text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const claims = await extractClaims(input.text);
      if (claims.length === 0) return [];

      const rows = claims.map((claim) => ({
        id: randomUUID(),
        organizationId: ctx.organizationId,
        scriptId: input.scriptId,
        devtag: `DT-${randomUUID().slice(0, 8)}`,
        claimText: claim.claimText,
        sourceUrl: null,
        confidenceScore: claim.confidenceScore.toFixed(3),
        verificationStatus: "pending" as const,
        isImmutable: true,
        createdAt: new Date(),
      }));

      await ctx.db.insert(claimLedger).values(rows);
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    }),

  /**
   * Real verification via researchProtocol — see that module for caveats.
   */
  verifyClaim: protectedProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [claim] = await ctx.db
        .select()
        .from(claimLedger)
        .where(and(eq(claimLedger.id, input.claimId), eq(claimLedger.organizationId, ctx.organizationId)))
        .limit(1);
      if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });

      const result = await verifyClaim(claim.claimText);

      await ctx.db
        .update(claimLedger)
        .set({
          verificationStatus: result.status,
          confidenceScore: result.confidence.toFixed(3),
          sourceUrl: result.topSourceUrl,
        })
        .where(eq(claimLedger.id, input.claimId));

      let snapshotId: string | null = null;
      try {
        const { createEvidenceSnapshot } = await import("../services/artifacts/service");
        const snap = await createEvidenceSnapshot({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          claimId: claim.id,
          verification: result,
          storeArtifact: true,
        });
        snapshotId = snap.snapshotId;
      } catch {
        /* artifact tables may not be migrated yet */
      }

      return { ...result, snapshotId };
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
        status: z.enum(["pending", "verified", "rejected", "unverifiable"]),
        sourceUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(claimLedger)
        .set({ verificationStatus: input.status, ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}) })
        .where(and(eq(claimLedger.id, input.claimId), eq(claimLedger.organizationId, ctx.organizationId)));
      return { ok: true };
    }),

  /** Verify up to N pending claims sequentially — real researchProtocol each. */
  verifyPendingBatch: protectedProcedure
    .input(
      z.object({
        scriptId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(10).default(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pending = input.scriptId
        ? await ctx.db
            .select()
            .from(claimLedger)
            .where(
              and(
                eq(claimLedger.scriptId, input.scriptId),
                eq(claimLedger.verificationStatus, "pending"),
                eq(claimLedger.organizationId, ctx.organizationId),
              ),
            )
            .orderBy(desc(claimLedger.createdAt))
            .limit(input.limit)
        : await ctx.db
            .select()
            .from(claimLedger)
            .where(
              and(
                eq(claimLedger.verificationStatus, "pending"),
                eq(claimLedger.organizationId, ctx.organizationId),
              ),
            )
            .orderBy(desc(claimLedger.createdAt))
            .limit(input.limit);

      const results: Array<{ claimId: string; status: string; snapshotId: string | null }> = [];
      for (const claim of pending) {
        const result = await verifyClaim(claim.claimText);
        await ctx.db
          .update(claimLedger)
          .set({
            verificationStatus: result.status,
            confidenceScore: result.confidence.toFixed(3),
            sourceUrl: result.topSourceUrl,
          })
          .where(eq(claimLedger.id, claim.id));
        let snapshotId: string | null = null;
        try {
          const { createEvidenceSnapshot } = await import("../services/artifacts/service");
          const snap = await createEvidenceSnapshot({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            claimId: claim.id,
            verification: result,
            storeArtifact: true,
          });
          snapshotId = snap.snapshotId;
        } catch {
          /* ignore */
        }
        results.push({ claimId: claim.id, status: result.status, snapshotId });
      }
      return { verified: results.length, results };
    }),
});
