import { randomUUID } from "node:crypto";
import { z } from "zod";
import { organizationProcedure, router } from "../_core/trpc";
import { publishResearchEvent } from "../_core/events";
import { godRouter } from "../lib/router-engine";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});

const laneSchema = z.enum(["speed", "research", "governance"]);

export const chatRouter = router({
  send: organizationProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(30),
        lane: laneSchema.default("speed"),
        research: z.boolean().default(false),
        researchRunId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const effectiveLane = input.research ? "research" : input.lane;
      const researchRunId = input.research ? input.researchRunId ?? randomUUID() : undefined;

      if (researchRunId) {
        publishResearchEvent({
          type: "research",
          organizationId: ctx.organizationId,
          runId: researchRunId,
          phase: "started",
          message: "Deep Research started on the research routing lane.",
        });
      }

      try {
        const result = await godRouter.route({
          lane: effectiveLane,
          messages: input.messages,
          research: input.research,
        });

        if (researchRunId) {
          publishResearchEvent({
            type: "research",
            organizationId: ctx.organizationId,
            runId: researchRunId,
            phase: "completed",
            message: "Deep Research completed.",
            provider: result.provider,
            model: result.model,
            attempts: result.attempts,
          });
        }

        return {
          reply: result.reply,
          lane: result.lane,
          provider: result.provider,
          model: result.model,
          researchUsed: result.researchUsed,
          attempts: result.attempts,
          researchRunId,
        };
      } catch (error) {
        if (researchRunId) {
          publishResearchEvent({
            type: "research",
            organizationId: ctx.organizationId,
            runId: researchRunId,
            phase: "failed",
            message: "Deep Research failed before completion.",
          });
        }
        throw error;
      }
    }),

  status: organizationProcedure.query(async () => godRouter.status()),
});
