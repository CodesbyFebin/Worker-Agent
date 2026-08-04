import { generateYoutubeMetadata } from "../services/metadata/youtubeMetadata";
import { generateThumbnailPrompt } from "../services/metadata/thumbnailPrompter";
import type { AgentExecutionContext } from "./base";

export async function executeSeoTask(ctx: AgentExecutionContext): Promise<{
  titles: string[];
  description: string;
  tags: string[];
  thumbnailPrompt: string;
}> {
  const [metadata, thumbnailPrompt] = await Promise.all([
    generateYoutubeMetadata({ scriptText: ctx.instructions, titleCount: 5 }),
    generateThumbnailPrompt(ctx.instructions),
  ]);

  return { ...metadata, thumbnailPrompt };
}
