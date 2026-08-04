import { completeJSON } from "../../_core/llm";

const SYSTEM_PROMPT = `You plan a multi-day YouTube content calendar around one broad
topic. Each day needs a distinct, specific angle — no repeats, no filler days.
Order them so early days build context for later ones where it makes sense.`;

export async function generateDailySubtopics(params: {
  topic: string;
  totalDays: number;
}): Promise<string[]> {
  const { topic, totalDays } = params;

  const { days } = await completeJSON<{ days: string[] }>({
    system: SYSTEM_PROMPT,
    prompt: `Topic: "${topic}"\nDays: ${totalDays}\n\nReturn JSON: { "days": string[] } with exactly ${totalDays} distinct daily video subtopics, ordered day 1 to day ${totalDays}.`,
    maxTokens: 1800,
  });

  if (!days || days.length !== totalDays) {
    throw new Error(`Expected ${totalDays} daily subtopics, got ${days?.length ?? 0}`);
  }
  return days;
}
