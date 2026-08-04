import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

/**
 * Instagram (via the Facebook Graph API) is a two-step flow: create a media
 * container referencing the video/image URL, then publish that container.
 * Requires a connected Instagram Business/Creator account behind
 * INSTAGRAM_BUSINESS_ACCOUNT_ID and a token with instagram_content_publish.
 */
export const publishToInstagram: PublishAdapter = async (content) => {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new PublisherConfigError("Instagram", [
      "INSTAGRAM_ACCESS_TOKEN",
      "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    ]);
  }
  if (!content.mediaUrl) {
    throw new Error("Instagram publishing requires content.mediaUrl");
  }

  const isVideo = /\.(mp4|mov)$/i.test(content.mediaUrl);
  const containerResponse = await fetch(
    `${GRAPH_BASE}/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: env.INSTAGRAM_ACCESS_TOKEN,
        caption: `${content.title}\n\n${content.description}`,
        ...(isVideo
          ? { media_type: "REELS", video_url: content.mediaUrl }
          : { image_url: content.mediaUrl }),
      }),
    },
  );

  if (!containerResponse.ok) {
    throw new Error(`Instagram container creation failed (${containerResponse.status}): ${await containerResponse.text()}`);
  }
  const container = (await containerResponse.json()) as { id: string };

  const publishResponse = await fetch(
    `${GRAPH_BASE}/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: env.INSTAGRAM_ACCESS_TOKEN,
        creation_id: container.id,
      }),
    },
  );

  if (!publishResponse.ok) {
    throw new Error(`Instagram publish failed (${publishResponse.status}): ${await publishResponse.text()}`);
  }
  const published = (await publishResponse.json()) as { id: string };

  return {
    platform: "instagram",
    externalId: published.id,
    publishedUrl: `https://www.instagram.com/p/${published.id}`,
  };
};
