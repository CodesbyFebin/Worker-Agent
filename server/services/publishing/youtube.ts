import fs from "fs/promises";
import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

/**
 * Uses the YouTube Data API v3 `videos.insert` endpoint directly (rather than
 * the googleapis client) to keep this dependency-free. YOUTUBE_ACCESS_TOKEN
 * must be a valid OAuth2 access token for the channel, with the
 * `youtube.upload` scope — refreshing that token is out of scope here and
 * should be handled by whatever token-management layer sits in front of this.
 */
export const publishToYoutube: PublishAdapter = async (content) => {
  if (!env.YOUTUBE_ACCESS_TOKEN || !env.YOUTUBE_CHANNEL_ID) {
    throw new PublisherConfigError("YouTube", ["YOUTUBE_ACCESS_TOKEN", "YOUTUBE_CHANNEL_ID"]);
  }
  if (!content.mediaUrl) {
    throw new Error("YouTube publishing requires content.mediaUrl (a rendered video file URL or local path)");
  }

  const isRemote = /^https?:\/\//i.test(content.mediaUrl);
  const videoBuffer = isRemote ? await fetchRemoteVideo(content.mediaUrl) : await fs.readFile(content.mediaUrl);

  const metadata = {
    snippet: {
      title: content.title,
      description: content.description,
      tags: content.tags ?? [],
      channelId: env.YOUTUBE_CHANNEL_ID,
    },
    status: { privacyStatus: "private" }, // safest default; flip to "public" once reviewed
  };

  const boundary = "god_machine_upload_boundary";
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/*\r\n\r\n`,
    ) as any,
    videoBuffer as any,
    Buffer.from(`\r\n--${boundary}--`) as any,
  ]) as unknown as Uint8Array<ArrayBuffer>;

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.YOUTUBE_ACCESS_TOKEN}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!response.ok) {
    throw new Error(`YouTube upload failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { id: string };
  return {
    platform: "youtube",
    externalId: data.id,
    publishedUrl: `https://youtube.com/watch?v=${data.id}`,
  };
};

async function fetchRemoteVideo(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch rendered video from mediaUrl (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}
