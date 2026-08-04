import { env } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";

export type ConnectorStatus = "connected" | "needs_attention" | "available" | "approval_required";

/**
 * Real connector/credential status from env — never returns secret values.
 * Powers Plugins & Connectors / Credentials / Settings UIs.
 */
export const connectorsRouter = router({
  list: protectedProcedure.query(() => {
    const rows: Array<{
      id: string;
      name: string;
      category: "llm" | "search" | "publishing" | "storage" | "devtools";
      description: string;
      status: ConnectorStatus;
      envKeys: string[];
      configured: boolean;
    }> = [
      {
        id: "anthropic",
        name: "Anthropic Claude",
        category: "llm",
        description: "Paid LLM provider for planning and agents",
        envKeys: ["ANTHROPIC_API_KEY"],
        configured: Boolean(env.ANTHROPIC_API_KEY),
        status: env.ANTHROPIC_API_KEY ? "connected" : "available",
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        category: "llm",
        description: "Free/cloud model router (:free + openrouter/free)",
        envKeys: ["OPENROUTER_API_KEY"],
        configured: Boolean(env.OPENROUTER_API_KEY),
        status: env.OPENROUTER_API_KEY ? "connected" : "available",
      },
      {
        id: "nvidia",
        name: "NVIDIA NIM",
        category: "llm",
        description: "Hosted NIM OpenAI-compatible endpoint",
        envKeys: ["NVIDIA_API_KEY"],
        configured: Boolean(env.NVIDIA_API_KEY),
        status: env.NVIDIA_API_KEY ? "connected" : "available",
      },
      {
        id: "groq",
        name: "Groq",
        category: "llm",
        description: "Free-tier Groq inference",
        envKeys: ["GROQ_API_KEY"],
        configured: Boolean(env.GROQ_API_KEY),
        status: env.GROQ_API_KEY ? "connected" : "available",
      },
      {
        id: "gemini",
        name: "Google Gemini",
        category: "llm",
        description: "Gemini free tier",
        envKeys: ["GEMINI_API_KEY"],
        configured: Boolean(env.GEMINI_API_KEY),
        status: env.GEMINI_API_KEY ? "connected" : "available",
      },
      {
        id: "pollinations",
        name: "Pollinations",
        category: "llm",
        description: "Anonymous/keyed text — rate limits apply",
        envKeys: ["POLLINATIONS_API_KEY"],
        configured: true,
        status: "connected",
      },
      {
        id: "tavily",
        name: "Web Research (Tavily)",
        category: "search",
        description: "Search for claim verification & research",
        envKeys: ["TAVILY_API_KEY"],
        configured: Boolean(env.TAVILY_API_KEY),
        status: env.TAVILY_API_KEY ? "connected" : "available",
      },
      {
        id: "brave",
        name: "Brave Search",
        category: "search",
        description: "Alternate search backend for researchProtocol",
        envKeys: ["BRAVE_SEARCH_API_KEY"],
        configured: Boolean(env.BRAVE_SEARCH_API_KEY),
        status: env.BRAVE_SEARCH_API_KEY ? "connected" : "available",
      },
      {
        id: "serper",
        name: "Serper",
        category: "search",
        description: "Google-results search adapter",
        envKeys: ["SERPER_API_KEY"],
        configured: Boolean(env.SERPER_API_KEY),
        status: env.SERPER_API_KEY ? "connected" : "available",
      },
      {
        id: "youtube",
        name: "YouTube Publisher",
        category: "publishing",
        description: "Upload/schedule Shorts & long-form",
        envKeys: ["YOUTUBE_ACCESS_TOKEN", "YOUTUBE_CHANNEL_ID"],
        configured: Boolean(env.YOUTUBE_ACCESS_TOKEN),
        status: env.YOUTUBE_ACCESS_TOKEN
          ? env.YOUTUBE_CHANNEL_ID
            ? "connected"
            : "needs_attention"
          : "available",
      },
      {
        id: "tiktok",
        name: "TikTok",
        category: "publishing",
        description: "Needs public media URL (known limit)",
        envKeys: ["TIKTOK_ACCESS_TOKEN"],
        configured: Boolean(env.TIKTOK_ACCESS_TOKEN),
        status: env.TIKTOK_ACCESS_TOKEN ? "needs_attention" : "available",
      },
      {
        id: "instagram",
        name: "Instagram",
        category: "publishing",
        description: "Reels via Graph API — public URL required",
        envKeys: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
        configured: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
        status:
          env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID
            ? "connected"
            : env.INSTAGRAM_ACCESS_TOKEN
              ? "needs_attention"
              : "available",
      },
      {
        id: "facebook",
        name: "Facebook Page",
        category: "publishing",
        description: "Page publishing adapter",
        envKeys: ["FACEBOOK_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"],
        configured: Boolean(env.FACEBOOK_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID),
        status:
          env.FACEBOOK_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID ? "connected" : "available",
      },
      {
        id: "twitter",
        name: "X / Twitter",
        category: "publishing",
        description: "Bearer token — posting may need OAuth1 (known limit)",
        envKeys: ["TWITTER_BEARER_TOKEN"],
        configured: Boolean(env.TWITTER_BEARER_TOKEN),
        status: env.TWITTER_BEARER_TOKEN ? "needs_attention" : "available",
      },
      {
        id: "linkedin",
        name: "LinkedIn",
        category: "publishing",
        description: "Org URN posting",
        envKeys: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORG_URN"],
        configured: Boolean(env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_ORG_URN),
        status:
          env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_ORG_URN ? "connected" : "available",
      },
      {
        id: "blogger",
        name: "Blogger",
        category: "publishing",
        description: "Google Blogger posts",
        envKeys: ["BLOGGER_API_KEY", "BLOGGER_BLOG_ID"],
        configured: Boolean(env.BLOGGER_API_KEY && env.BLOGGER_BLOG_ID),
        status: env.BLOGGER_API_KEY && env.BLOGGER_BLOG_ID ? "connected" : "available",
      },
      {
        id: "github",
        name: "GitHub",
        category: "devtools",
        description: "Repo for God Machine worktrees / PRs",
        envKeys: ["GITHUB_TOKEN", "GITHUB_REPO"],
        configured: Boolean(env.GITHUB_TOKEN),
        status: env.GITHUB_TOKEN ? (env.GITHUB_REPO ? "connected" : "needs_attention") : "available",
      },
    ];

    // Mark publishing without keys as available; if LLM_PROVIDER forced but key missing → approval/attention
    const summary = {
      connected: rows.filter((r) => r.status === "connected").length,
      needsAttention: rows.filter((r) => r.status === "needs_attention").length,
      available: rows.filter((r) => r.status === "available").length,
      approvalRequired: rows.filter((r) => r.status === "approval_required").length,
    };

    return {
      connectors: rows,
      summary,
      llmProvider: env.LLM_PROVIDER,
      asOf: new Date().toISOString(),
    };
  }),
});
