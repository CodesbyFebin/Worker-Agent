import { env } from "../../_core/env";
import { PublisherConfigError, type PublishAdapter } from "./types";

/**
 * Posts a text share via LinkedIn's UGC Posts API to an organization page.
 * LINKEDIN_ORG_URN should look like "urn:li:organization:12345".
 * Token needs the w_organization_social scope.
 */
export const publishToLinkedin: PublishAdapter = async (content) => {
  if (!env.LINKEDIN_ACCESS_TOKEN || !env.LINKEDIN_ORG_URN) {
    throw new PublisherConfigError("LinkedIn", ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORG_URN"]);
  }

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: env.LINKEDIN_ORG_URN,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content.bodyText ?? `${content.title}\n\n${content.description}` },
          shareMediaCategory: content.mediaUrl ? "ARTICLE" : "NONE",
          ...(content.mediaUrl
            ? { media: [{ status: "READY", originalUrl: content.mediaUrl }] }
            : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn post failed (${response.status}): ${await response.text()}`);
  }

  const postId = response.headers.get("x-restli-id") ?? "";
  return {
    platform: "linkedin",
    externalId: postId,
    publishedUrl: `https://www.linkedin.com/feed/update/${postId}`,
  };
};
