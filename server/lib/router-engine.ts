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
  health?: {
    cooldown_after_rate_limit_seconds?: number;
    failure_threshold?: number;
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

type ProviderHealth = {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastFailureAt?: number;
  lastError?: string;
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
  private readonly health = new Map<string, ProviderHealth>();

  private healthFor(name: string): ProviderHealth {
    const existing = this.health.get(name);
    if (existing) return existing;
    const fresh: ProviderHealth = { consecutiveFailures: 0, cooldownUntil: 0 };
    this.health.set(name, fresh);
    return fresh;
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(250 * 2 ** Math.max(0, attempt - 1), 2000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async route(request: RouteRequest): Promise<RouteResult> {
    const config = await loadConfig();
    const lane = config.lanes[request.lane];
    if (!lane) throw new Error(`Lane ${request.lane} not found`);

    const providers = lane.providers
      .filter((provider) => {
        if (!providerEnabled(provider)) return false;
        if (request.research && !provider.supports_web_search) return false;
        return this.healthFor(provider.name).cooldownUntil <= Date.now();
      });

    if (!providers.length) {
      throw new Error(`No currently healthy providers satisfy lane=${request.lane}${request.research ? " and web-search capability" : ""}`);
    }

    let attempts = 0;
    let lastError: unknown;
    const cooldownSeconds = config.health?.cooldown_after_rate_limit_seconds ?? 60;
    const failureThreshold = config.health?.failure_threshold ?? 3;

    for (const provider of providers.slice(0, config.selection.max_attempts_per_request)) {
      attempts += 1;
      const started = Date.now();
      const state = this.healthFor(provider.name);
      try {
        const result = await callProvider(provider, request, config.selection.timeout_ms);
        state.consecutiveFailures = 0;
        state.cooldownUntil = 0;
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
        state.consecutiveFailures += 1;
        state.lastFailureAt = Date.now();
        state.lastError = error instanceof Error ? error.message : String(error);
        const retryable = typeof status === "number" ? isRetryable(status, config) : true;
        if ((status === 429 || state.consecutiveFailures >= failureThreshold) && retryable) {
          state.cooldownUntil = Date.now() + cooldownSeconds * 1000;
        }
        console.warn(JSON.stringify({
          event: "worker_agent_router",
          lane: request.lane,
          provider: provider.name,
          status: "failed",
          retryable,
          httpStatus: status,
          latency_ms: Date.now() - started,
          cooldown_until: state.cooldownUntil || null,
          runtime: isLocalRuntime ? "local" : "cloud",
        }));
        if (typeof status === "number" && !retryable) break;
        if (attempts < config.selection.max_attempts_per_request) await this.backoff(attempts);
      }
    }

    throw new Error(`All Worker Agent providers failed for lane=${request.lane}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  }

  async status() {
    const config = await loadConfig();
    const now = Date.now();
    return {
      runtime: isLocalRuntime ? "local" : "cloud",
      lanes: Object.fromEntries(
        Object.entries(config.lanes).map(([name, lane]) => [
          name,
          {
            priority: lane.priority,
            providers: lane.providers.map((provider) => {
              const health = this.healthFor(provider.name);
              return {
                name: provider.name,
                model: getModel(provider),
                enabled: providerEnabled(provider),
                localOnly: Boolean(provider.local_only),
                webSearch: provider.supports_web_search,
                costClass: provider.cost_class,
                cooldownUntil: health.cooldownUntil || null,
                cooldownSeconds: health.cooldownUntil > now ? Math.ceil((health.cooldownUntil - now) / 1000) : 0,
                consecutiveFailures: health.consecutiveFailures,
              };
            }),
          },
        ]),
      ),
    };
  }
}

export const godRouter = new GodRouter();
export const kiloRouter = godRouter;
