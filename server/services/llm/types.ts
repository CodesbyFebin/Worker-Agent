export type LlmProviderId =
  | "anthropic"
  | "ollama"
  | "groq"
  | "gemini"
  | "pollinations"
  | "openrouter"
  | "nvidia";

export interface LlmCompleteParams {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Optional per-call override; otherwise router uses env defaults. */
  model?: string;
}

export interface LlmCompleteResult {
  text: string;
  provider: LlmProviderId;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmProviderStatus {
  id: LlmProviderId;
  label: string;
  free: boolean;
  configured: boolean;
  reachable: boolean | null;
  defaultModel: string;
  note: string;
  /** Live free/cloud model ids when the provider key can list them. */
  freeModels?: Array<{ id: string; name: string }>;
}
