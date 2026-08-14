import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ProviderConfig = {
  name: string;
  model?: string;
  model_env?: string;
  model_default?: string;
  protocol: "openai-compatible" | "openai-responses" | "gemini-interactions";
  base_url: string;
  api_key?: string;
  api_key_env?: string;
  supports_web_search: boolean;
  privacy: "local" | "cloud";
  cost_class: "local" | "free-tier" | "paid";
  local_only?: boolean;
  requires_env?: string;
};

type LaneConfig = {
  priority: number;
  description: string;
  providers: ProviderConfig[];
};

type RouterConfig = {
  lanes: Record<string, LaneConfig>;
  selection: {
    strategy: "priority-fallback";
    retryable_statuses: number[];
    timeout_ms: number;
    max_attempts_per_request: number;
  };
};

export type RouterMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RouteRequest = {
  lane: keyof RouterConfig["lanes"];
  messages: RouterMessage[];
  research?: boolean;
};

export type RouteResult = {
  reply: string;
  lane: string;
  provider: string;
  model: string;
  researchUsed: boolean;
  attempts: number;
};

type ProviderResult = {
  reply: string;
  researchUsed: boolean;
};

const CONFIG_PATH = join(process.cwd(), "kilo-router-db.json");
const isLocalRuntime = process.env.NODE_ENV === "development" && !process.env.VERCEL;

const GOVERNANCE_INSTRUCTIONS = `You are Worker Agent, the command intelligence layer for an autonomous operating system for AI-powered content networks.

Governance is mandatory. Never provide instructions for copyright evasion, platform-detection evasion, spam, fake engagement, credential abuse, identity isolation, or bypassing platform safeguards. When a request crosses that boundary, explain the risk and propose a compliant alternative.

When proposing an action that could publish, spend money, alter a live channel, or change governance, make the action explicit and identify where human approval is required.

Prefer concise operator-style answers with assessment, recommended action, expected outcome, and next step when useful.`;

async function loadConfig(): Promise<RouterConfig> {
  const raw = await readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw) as RouterConfig;
}

function getModel(config: ProviderConfig): string {
  if (config.model_env) return process.env[config.model_env] || config.model_default || "";
  return config.model || "";
}

function getApiKey(config: ProviderConfig): string | undefined {
  if (config.api_key) return config.api_key;
  return config.api_key_env ? process.env[config.api_key_env] : undefined;
}

function isRetryable(status: number, config: RouterConfig): boolean {
  return config.selection.retryable_statuses.includes(status);
}

function providerEnabled(config: ProviderConfig): boolean {
  if (config.local_only && !isLocalRuntime) return false;
  if (config.requires_env && process.env[config.requires_env] !== "true") return false;
  const model = getModel(config);
  const key = getApiKey(config);
  return Boolean(model) && (config.privacy === "local" || Boolean(key));
}

async function postJson(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractOpenAIText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as {
    output_text?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (typeof value.output_text === "string") return value.output_text.trim();
  const content = value.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

async function callOpenAICompatible(
  config: ProviderConfig,
  request: RouteRequest,
  timeoutMs: number,
): Promise<ProviderResult> {
  const key = getApiKey(config) ?? "ollama";
  const model = getModel(config);
  if (!model) throw new Error(`${config.name} model is not configured`);

  const response = await postJson(
    `${config.base_url.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: GOVERNANCE_INSTRUCTIONS },
          ...request.messages,
        ],
        stream: false,
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`${config.name} returned ${response.status}: ${detail.slice(0, 300)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const reply = extractOpenAIText(payload);
  if (!reply) throw new Error(`${config.name} returned an empty response`);
  return { reply, researchUsed: false };
}

async function callOpenAIResponses(
  config: ProviderConfig,
  request: RouteRequest,
  timeoutMs: number,
): Promise<ProviderResult> {
  const key = getApiKey(config);
  if (!key) throw new Error(`${config.name} key is not configured`);
  const model = getModel(config);
  if (!model) throw new Error(`${config.name} model is not configured`);

  const response = await postJson(
    config.base_url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: GOVERNANCE_INSTRUCTIONS,
        input: request.messages,
        tools: request.research ? [{ type: "web_search" }] : undefined,
        store: false,
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`${config.name} returned ${response.status}: ${detail.slice(0, 300)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const reply = extractOpenAIText(payload);
  if (!reply) throw new Error(`${config.name} returned an empty response`);
  return { reply, researchUsed: Boolean(request.research) };
}

async function callGeminiInteractions(
  config: ProviderConfig,
  request: RouteRequest,
  timeoutMs: number,
): Promise<ProviderResult> {
  const key = getApiKey(config);
  if (!key) throw new Error(`${config.name} key is not configured`);
  const model = getModel(config);
  if (!model) throw new Error(`${config.name} model is not configured`);

  const input = request.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const response = await postJson(
    config.base_url,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        tools: request.research ? [{ type: "google_search" }] : undefined,
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`${config.name} returned ${response.status}: ${detail.slice(0, 300)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = (await response.json()) as { output_text?: string };
  const reply = payload.output_text?.trim() || "";
  if (!reply) throw new Error(`${config.name} returned an empty response`);
  return { reply, researchUsed: Boolean(request.research) };
}

async function callProvider(config: ProviderConfig, request: RouteRequest, timeoutMs: number): Promise<ProviderResult> {
  switch (config.protocol) {
    case "openai-compatible":
      return callOpenAICompatible(config, request, timeoutMs);
    case "openai-responses":
      return callOpenAIResponses(config, request, timeoutMs);
    case "gemini-interactions":
      return callGeminiInteractions(config, request, timeoutMs);
  }
}

export class GodRouter {
  async route(request: RouteRequest): Promise<RouteResult> {
    const config = await loadConfig();
    const lane = config.lanes[request.lane];
    if (!lane) throw new Error(`Lane ${request.lane} not found`);

    const providers = lane.providers.filter((provider) => {
      if (!providerEnabled(provider)) return false;
      if (request.research && !provider.supports_web_search) return false;
      return true;
    });

    if (!providers.length) {
      throw new Error(`No configured providers satisfy lane=${request.lane}${request.research ? " and web-search capability" : ""}`);
    }

    let attempts = 0;
    let lastError: unknown;

    for (const provider of providers.slice(0, config.selection.max_attempts_per_request)) {
      attempts += 1;
      const started = Date.now();
      try {
        const result = await callProvider(provider, request, config.selection.timeout_ms);
        console.info(JSON.stringify({
          event: "worker_agent_router",
          lane: request.lane,
          provider: provider.name,
          model: getModel(provider),
          status: "success",
          research: result.researchUsed,
          attempts,
          latency_ms: Date.now() - started,
          runtime: isLocalRuntime ? "local" : "cloud",
        }));
        return {
          reply: result.reply,
          lane: request.lane,
          provider: provider.name,
          model: getModel(provider),
          researchUsed: result.researchUsed,
          attempts,
        };
      } catch (error) {
        lastError = error;
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : undefined;
        console.warn(JSON.stringify({
          event: "worker_agent_router",
          lane: request.lane,
          provider: provider.name,
          status: "failed",
          retryable: typeof status === "number" ? isRetryable(status, config) : true,
          httpStatus: status,
          latency_ms: Date.now() - started,
          runtime: isLocalRuntime ? "local" : "cloud",
        }));
        if (typeof status === "number" && !isRetryable(status, config)) break;
      }
    }

    throw new Error(`All Worker Agent providers failed for lane=${request.lane}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  }

  async status() {
    const config = await loadConfig();
    return {
      runtime: isLocalRuntime ? "local" : "cloud",
      lanes: Object.fromEntries(
        Object.entries(config.lanes).map(([name, lane]) => [
          name,
          {
            priority: lane.priority,
            providers: lane.providers.map((provider) => ({
              name: provider.name,
              model: getModel(provider),
              enabled: providerEnabled(provider),
              localOnly: Boolean(provider.local_only),
              webSearch: provider.supports_web_search,
              costClass: provider.cost_class,
            })),
          },
        ]),
      ),
    };
  }
}

export const godRouter = new GodRouter();
export const kiloRouter = godRouter;
