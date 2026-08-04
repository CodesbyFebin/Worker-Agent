import { completeJSON } from "../../_core/llm";

interface YoutubeMetadataResult {
  titles: string[];
  description: string;
  tags: string[];
}

const SYSTEM_PROMPT = `You are the metadata specialist for a YouTube content pipeline.
Given a video script, produce click-worthy but accurate titles, an SEO-friendly
description, and a tag list. Never invent claims that are not supported by the
script text — the description must only describe what the script actually says.`;

export async function generateYoutubeMetadata(params: {
  scriptText: string;
  titleCount: number;
}): Promise<YoutubeMetadataResult> {
  const { scriptText, titleCount } = params;

  return completeJSON<YoutubeMetadataResult>({
    system: SYSTEM_PROMPT,
    prompt: `Script:\n"""\n${scriptText}\n"""\n\nReturn JSON of the shape:\n{\n  "titles": string[] (exactly ${titleCount} options, each under 100 characters),\n  "description": string (2-3 short paragraphs, SEO-friendly, no invented claims),\n  "tags": string[] (10-15 relevant search tags)\n}`,
    maxTokens: 1200,
  });
}
