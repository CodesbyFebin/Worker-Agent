import { pluginRegistry } from "./registry";
import type { AiProviderPlugin } from "./contracts";
import type { PluginPermission } from "./registry";

const manifest = {
  id: "builtin.dummy-ai",
  name: "Dummy AI Provider",
  version: "1.0.0",
  description: "Fallback AI provider for local development",
  author: "ContentOS",
  capabilities: ["complete"],
  permissions: ["ai:complete"] as PluginPermission[],
};

const capabilities = { streaming: false, batchOperations: false };

const plugin: AiProviderPlugin = {
  type: "ai_provider",
  manifest: manifest as any,
  capabilities,
  async complete({ prompt }) {
    return { text: `[dummy] ${prompt.slice(0, 120)}`, usage: { promptTokens: prompt.length, completionTokens: 0, totalTokens: prompt.length } };
  },
  healthCheck() {
    return Promise.resolve({ ok: true, latencyMs: 0, model: "dummy" });
  },
};

pluginRegistry.register(plugin);
export default plugin;
