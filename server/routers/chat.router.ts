import { z } from "zod";
import { organizationProcedure, router } from "../_core/trpc";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});

const instructions = `You are Worker Agent, the command intelligence layer for an autonomous operating system for AI-powered content networks.

Your job is to help operators research opportunities, reason about content systems, decompose missions, interpret performance, and improve the next publishing cycle.

Governance is mandatory. Never provide instructions for copyright evasion, platform-detection evasion, spam, fake engagement, credential abuse, identity isolation, or other attempts to bypass platform safeguards. When a request crosses that boundary, explain the risk and propose a compliant alternative.

When proposing an action that could publish, spend money, alter a live channel, or change governance, make the action explicit and identify where human approval is required.

Prefer concise operator-style answers with: assessment, recommended action, expected outcome, and next step when useful.`;

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof value.output_text === "string" && value.output_text.trim()) {
    return value.output_text.trim();
  }

  return (value.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
}

export const chatRouter = router({
  send: organizationProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(30),
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured on the server");
      }
      if (!model) {
        throw new Error("OPENAI_MODEL is not configured on the server");
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions,
          input: input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          store: false,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        console.error("OpenAI Responses API error", response.status, details.slice(0, 2000));
        throw new Error("Worker Agent could not reach the model provider");
      }

      const payload = await response.json();
      const reply = extractOutputText(payload);

      if (!reply) {
        throw new Error("Worker Agent received an empty model response");
      }

      return { reply };
    }),
});
