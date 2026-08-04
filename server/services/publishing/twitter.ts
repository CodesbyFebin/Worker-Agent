import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

/**
 * Posts a tweet via API v2. Note: creating tweets on a user's behalf
 * typically requires OAuth 1.0a user-context signing or an OAuth2 user
 * access token with `tweet.write` — a plain app-only Bearer token is NOT
 * sufficient for posting in practice. TWITTER_BEARER_TOKEN here is assumed
 * to be a user-context token already obtained through your own OAuth flow;
 * that flow itself is out of scope for this adapter.
 */
export const publishToTwitter: PublishAdapter = async (content) => {
  if (!env.TWITTER_BEARER_TOKEN) {
    throw new PublisherConfigError("X / Twitter", ["TWITTER_BEARER_TOKEN"]);
  }

  const text = (content.bodyText ?? `${content.title}\n\n${content.description}`).slice(0, 280);

  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`X/Twitter post failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { data: { id: string } };

  return {
    platform: "twitter",
    externalId: data.data.id,
    publishedUrl: `https://x.com/i/web/status/${data.data.id}`,
  };
};
