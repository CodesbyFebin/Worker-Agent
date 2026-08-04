import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

/**
 * Posts to a Facebook Page (not a personal profile — the Graph API doesn't
 * support posting to personal timelines for apps). Requires a Page access
 * token with pages_manage_posts.
 */
export const publishToFacebook: PublishAdapter = async (content) => {
  if (!env.FACEBOOK_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
    throw new PublisherConfigError("Facebook", ["FACEBOOK_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"]);
  }

  const isVideo = content.mediaUrl && /\.(mp4|mov)$/i.test(content.mediaUrl);
  const endpoint = isVideo ? "videos" : "feed";

  const response = await fetch(`${GRAPH_BASE}/${env.FACEBOOK_PAGE_ID}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: env.FACEBOOK_ACCESS_TOKEN,
      ...(isVideo
        ? { file_url: content.mediaUrl, description: content.description }
        : {
            message: `${content.title}\n\n${content.bodyText ?? content.description}`,
            ...(content.mediaUrl ? { link: content.mediaUrl } : {}),
          }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Facebook post failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string; post_id?: string };
  const externalId = data.post_id ?? data.id;

  return {
    platform: "facebook",
    externalId,
    publishedUrl: `https://www.facebook.com/${externalId}`,
  };
};
