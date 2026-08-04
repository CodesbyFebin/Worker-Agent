import { complete } from "../../_core/llm";
import type { SectionKind } from "../../../shared/types";

const KIND_GUIDANCE: Record<SectionKind, string> = {
  hook: "This is the opening hook. It must grab attention in the first 2 seconds — urgency, curiosity, or a bold claim.",
  body: "This is the main body. Prioritize clarity and pacing over cleverness.",
  cta: "This is the call to action. Be direct about the single next step you want the viewer to take.",
  outro: "This is the outro. Wrap up crisply — no new information, just a clean close.",
  custom: "Treat this as a general section — match the tone of the rest of the script.",
};

const SYSTEM_PROMPT = `You are the writer agent for a short-form video script pipeline.
You rewrite one section of a script at a time, in isolation. Preserve the
facts and claims already present — do not introduce new factual claims that
weren't implied by the original text. Match the register of a spoken video
script, not an essay. Return only the rewritten section text, nothing else.`;

export async function regenerateSectionText(params: {
  kind: SectionKind;
  currentContent: string;
  instruction?: string;
}): Promise<string> {
  const { kind, currentContent, instruction } = params;

  const prompt = [
    KIND_GUIDANCE[kind],
    `Current section text:\n"""\n${currentContent}\n"""`,
    instruction ? `Creative direction: ${instruction}` : null,
    "Rewrite this section now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await complete({ system: SYSTEM_PROMPT, prompt, maxTokens: 500 });
  return result.trim();
}
