import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

/**
 * TikTok's Content Posting API is a two-step flow: init a post (get an
 * upload_url + publish_id back), then PUT the raw video bytes to that URL.
 * TIKTOK_ACCESS_TOKEN must already have the `video.publish` scope granted —
 * TikTok content posting requires app review before it works outside sandbox.
 */
export const publishToTiktok: PublishAdapter = async (content) => {
  if (!env.TIKTOK_ACCESS_TOKEN) {
    throw new PublisherConfigError("TikTok", ["TIKTOK_ACCESS_TOKEN"]);
  }
  if (!content.mediaUrl) {
    throw new Error("TikTok publishing requires content.mediaUrl (a rendered video file URL)");
  }

  const videoResponse = await fetch(content.mediaUrl);
  if (!videoResponse.ok) {
    throw new Error(`Could not fetch rendered video from mediaUrl (${videoResponse.status})`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const initResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TIKTOK_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: content.title,
        privacy_level: "SELF_ONLY", // safest default until reviewed
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoBuffer.byteLength,
        chunk_size: videoBuffer.byteLength,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`TikTok init failed (${initResponse.status}): ${await initResponse.text()}`);
  }

  const initData = (await initResponse.json()) as {
    data: { publish_id: string; upload_url: string };
  };

  const uploadResponse = await fetch(initData.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoBuffer.byteLength - 1}/${videoBuffer.byteLength}`,
    },
    body: videoBuffer as any,
  });

  if (!uploadResponse.ok) {
    throw new Error(`TikTok upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`);
  }

  return {
    platform: "tiktok",
    externalId: initData.data.publish_id,
    publishedUrl: `https://www.tiktok.com/publish/${initData.data.publish_id}`,
  };
};
