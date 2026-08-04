import { PUBLISH_ADAPTERS, type PublishPlatform, type PublishContent } from "../services/publishing";
import type { AgentExecutionContext } from "./base";

interface PublisherTaskPayload {
  platforms: PublishPlatform[];
  content: PublishContent;
}

interface PlatformOutcome {
  platform: PublishPlatform;
  ok: boolean;
  publishedUrl?: string;
  error?: string;
}

/**
 * Publishes to every requested platform independently — one platform's
 * failure (e.g. a missing token) doesn't block the others from succeeding.
 * The task overall fails only if EVERY requested platform failed.
 */
export async function executePublishTask(ctx: AgentExecutionContext): Promise<{
  results: PlatformOutcome[];
}> {
  const payload = ctx.rawPayload as unknown as PublisherTaskPayload;
  if (!payload.platforms?.length || !payload.content) {
    throw new Error('Publisher task payload must include "platforms" and "content"');
  }

  const results = await Promise.all(
    payload.platforms.map(async (platform): Promise<PlatformOutcome> => {
      const adapter = PUBLISH_ADAPTERS[platform];
      if (!adapter) return { platform, ok: false, error: `Unknown platform "${platform}"` };
      try {
        const result = await adapter(payload.content);
        return { platform, ok: true, publishedUrl: result.publishedUrl };
      } catch (err) {
        return { platform, ok: false, error: (err as Error).message };
      }
    }),
  );

  if (results.every((r) => !r.ok)) {
    throw new Error(`Publishing failed on all platforms: ${results.map((r) => `${r.platform}: ${r.error}`).join("; ")}`);
  }

  return { results };
}
