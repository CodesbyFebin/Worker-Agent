import { z } from "zod";
import { organizationProcedure, router } from "../_core/trpc";
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
      }),
    )
    .mutation(async ({ input }) => {
      const effectiveLane = input.research ? "research" : input.lane;
      const result = await godRouter.route({
        lane: effectiveLane,
        messages: input.messages,
        research: input.research,
      });

      return {
        reply: result.reply,
        lane: result.lane,
        provider: result.provider,
        model: result.model,
        researchUsed: result.researchUsed,
        attempts: result.attempts,
      };
    }),

  status: organizationProcedure.query(async () => godRouter.status()),
});
