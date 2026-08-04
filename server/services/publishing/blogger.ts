import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

/**
 * Blogger's write endpoints require OAuth2 (an API key alone is read-only),
 * so BLOGGER_API_KEY here is used as a Bearer OAuth access token despite the
 * name — rename the env var in your deployment if that's confusing.
 */
export const publishToBlogger: PublishAdapter = async (content) => {
  if (!env.BLOGGER_API_KEY || !env.BLOGGER_BLOG_ID) {
    throw new PublisherConfigError("Blogger", ["BLOGGER_API_KEY", "BLOGGER_BLOG_ID"]);
  }

  const response = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${env.BLOGGER_BLOG_ID}/posts/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.BLOGGER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: content.title,
        content: content.bodyText ?? content.description,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Blogger post failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string; url: string };

  return { platform: "blogger", externalId: data.id, publishedUrl: data.url };
};
