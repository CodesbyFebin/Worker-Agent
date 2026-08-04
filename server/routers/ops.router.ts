import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../_core/auth/audit";
import { metricsSnapshot } from "../_core/metrics";
import { sandboxInfo } from "../_core/sandbox";
import {
  deadLetterCounts,
  discardDeadLetter,
  listDeadLetters,
  queueDepthSnapshot,
  retryDeadLetter,
} from "../services/ops/deadLetter";

export const opsRouter = router({
  sandboxInfo: permissionProcedure("ops:recover").query(() => sandboxInfo()),

  metrics: permissionProcedure("ops:recover").query(async ({ ctx }) => {
    const [queues, dlq] = await Promise.all([
      queueDepthSnapshot(),
      deadLetterCounts(ctx.organizationId),
    ]);
    return {
      process: metricsSnapshot(),
      queues,
      dlq,
    };
  }),

  dlqCounts: permissionProcedure("ops:recover").query(async ({ ctx }) => {
    return deadLetterCounts(ctx.organizationId);
  }),

  listDlq: permissionProcedure("ops:recover")
    .input(
      z
        .object({
          status: z.enum(["open", "retried", "discarded"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listDeadLetters({
        organizationId: ctx.organizationId,
        status: input?.status,
        limit: input?.limit,
      });
    }),

  retryDlq: permissionProcedure("ops:recover")
    .input(z.object({ deadLetterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await retryDeadLetter({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        deadLetterId: input.deadLetterId,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ops.dlq_retry",
        resourceType: "dead_letter_job",
        resourceId: input.deadLetterId,
        payload: { newJobId: result.jobId },
      });
      return result;
    }),

  discardDlq: permissionProcedure("ops:recover")
    .input(z.object({ deadLetterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await discardDeadLetter({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        deadLetterId: input.deadLetterId,
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "ops.dlq_discard",
        resourceType: "dead_letter_job",
        resourceId: input.deadLetterId,
      });
      return result;
    }),
});
