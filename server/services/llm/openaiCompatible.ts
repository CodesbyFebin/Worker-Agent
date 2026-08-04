import type { LlmCompleteParams, LlmCompleteResult, LlmProviderId } from "./types";

/**
 * Shared OpenAI Chat Completions client — used by OpenRouter, NVIDIA NIM,
 * Groq, and any other OpenAI-compatible free cloud endpoint.
 */
export async function completeOpenAICompatible(opts: {
  provider: LlmProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  params: LlmCompleteParams;
  extraHeaders?: Record<string, string>;
}): Promise<LlmCompleteResult> {
  const root = opts.baseUrl.replace(/\/$/, "");

  async function once(): Promise<LlmCompleteResult> {
    const res = await fetch(`${root}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        ...opts.extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.params.maxTokens ?? 1024,
        messages: [
          { role: "system", content: opts.params.system },
          { role: "user", content: opts.params.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${opts.provider} failed (${res.status}): ${body.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | Array<{ type?: string; text?: string }> | null };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };

    if (data.error?.message) {
      throw new Error(`${opts.provider}: ${data.error.message}`);
    }

    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      text = content
        .map((p) => (typeof p === "object" && p && "text" in p ? String(p.text ?? "") : ""))
        .join("");
    }
    if (!text.trim()) {
      throw new Error(
        `${opts.provider} response had no content` +
          (choice?.finish_reason ? ` (finish_reason=${choice.finish_reason})` : ""),
      );
    }

    return {
      text,
      provider: opts.provider,
      model: data.model ?? opts.model,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  }

  try {
    return await once();
  } catch (err) {
    // Free-tier flakiness: empty choices / brief 429 — one short retry
    const msg = (err as Error).message;
    if (/no content|429|rate/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 1200));
      return once();
    }
    throw err;
  }
}

export interface CatalogModel {
  id: string;
  name: string;
  free: boolean;
  contextLength: number | null;
}

export async function listOpenAICompatibleModels(opts: {
  baseUrl: string;
  apiKey: string;
  extraHeaders?: Record<string, string>;
}): Promise<CatalogModel[]> {
  const root = opts.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${root}/models`, {
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      ...opts.extraHeaders,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`models list failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string | number; completion?: string | number };
    }>;
  };

  return (data.data ?? []).map((m) => {
    const promptPrice = m.pricing?.prompt != null ? Number(m.pricing.prompt) : null;
    const completionPrice = m.pricing?.completion != null ? Number(m.pricing.completion) : null;
    const freeByPrice =
      promptPrice === 0 && (completionPrice === null || completionPrice === 0);
    const freeBySuffix = m.id.endsWith(":free") || m.id.includes("/free");
    return {
      id: m.id,
      name: m.name ?? m.id,
      free: freeByPrice || freeBySuffix,
      contextLength: m.context_length ?? null,
    };
  });
}
