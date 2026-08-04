import { z } from "zod";

const llmProviderSchema = z.enum([
  "auto",
  "anthropic",
  "ollama",
  "openrouter",
  "nvidia",
  "groq",
  "gemini",
  "pollinations",
]);

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // Optional when a free backend is used (ollama / openrouter / nvidia / pollinations / groq / gemini / auto).
    ANTHROPIC_API_KEY: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    LLM_PROVIDER: llmProviderSchema.default("auto"),
    /** Optional model id override for the active provider. */
    LLM_MODEL: z.string().optional(),
    /** Comma-separated provider try-order when LLM_PROVIDER=auto. */
    LLM_FALLBACK: z
      .string()
      .default("ollama,openrouter,nvidia,pollinations,groq,gemini,anthropic"),
    OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),

    /** OpenRouter — free models via openrouter/free or *:free (https://openrouter.ai/keys). */
    OPENROUTER_API_KEY: z.string().optional(),
    /** NVIDIA NIM — https://build.nvidia.com (nvapi-…). */
    NVIDIA_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    POLLINATIONS_API_KEY: z.string().optional(),

    GITHUB_TOKEN: z.string().optional(),
    GITHUB_REPO: z.string().optional(),
    GITHUB_BASE_BRANCH: z.string().default("main"),

    YOUTUBE_ACCESS_TOKEN: z.string().optional(),
    YOUTUBE_CHANNEL_ID: z.string().optional(),
    TIKTOK_ACCESS_TOKEN: z.string().optional(),
    INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
    INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
    FACEBOOK_ACCESS_TOKEN: z.string().optional(),
    FACEBOOK_PAGE_ID: z.string().optional(),
    TWITTER_BEARER_TOKEN: z.string().optional(),
    LINKEDIN_ACCESS_TOKEN: z.string().optional(),
    LINKEDIN_ORG_URN: z.string().optional(),
    BLOGGER_API_KEY: z.string().optional(),
    BLOGGER_BLOG_ID: z.string().optional(),

    PRICE_PER_MILLION_INPUT_TOKENS_USD: z.coerce.number().default(0),
    PRICE_PER_MILLION_OUTPUT_TOKENS_USD: z.coerce.number().default(0),

    TAVILY_API_KEY: z.string().optional(),
    BRAVE_SEARCH_API_KEY: z.string().optional(),
    SERPER_API_KEY: z.string().optional(),

    REDIS_URL: z.string().default("redis://localhost:6379"),

    GOD_MACHINE_REPO_ROOT: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.LLM_PROVIDER === "anthropic" && !val.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
        path: ["ANTHROPIC_API_KEY"],
      });
    }
    if (val.LLM_PROVIDER === "openrouter" && !val.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter",
        path: ["OPENROUTER_API_KEY"],
      });
    }
    if (val.LLM_PROVIDER === "nvidia" && !val.NVIDIA_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NVIDIA_API_KEY is required when LLM_PROVIDER=nvidia",
        path: ["NVIDIA_API_KEY"],
      });
    }
    if (val.LLM_PROVIDER === "groq" && !val.GROQ_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GROQ_API_KEY is required when LLM_PROVIDER=groq",
        path: ["GROQ_API_KEY"],
      });
    }
    if (val.LLM_PROVIDER === "gemini" && !val.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GEMINI_API_KEY is required when LLM_PROVIDER=gemini",
        path: ["GEMINI_API_KEY"],
      });
    }
  });

export const env = envSchema.parse(process.env);
