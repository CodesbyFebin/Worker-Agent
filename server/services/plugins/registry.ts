import type { ContentOSPlugin } from "./contracts";

export type PluginPermission = "ai:complete" | "publishing:write" | "storage:read" | "storage:write";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  capabilities: string[];
  permissions: PluginPermission[];
}

export interface PluginCapabilities {
  streaming?: boolean;
  scheduling?: boolean;
  analytics?: boolean;
  batchOperations?: boolean;
}

export interface RegisteredPlugin {
  plugin: ContentOSPlugin;
  manifest: PluginManifest;
  capabilities: PluginCapabilities;
  loadedAt: Date;
  lastHealthCheck?: { ok: boolean; checkedAt: Date };
}

class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();

  register(plugin: ContentOSPlugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin ${plugin.manifest.id} already registered`);
    }
    const entry: RegisteredPlugin = {
      plugin,
      manifest: plugin.manifest,
      capabilities: plugin.capabilities,
      loadedAt: new Date(),
    };
    this.plugins.set(plugin.manifest.id, entry);
  }

  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  get(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  list(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  listByType(type: ContentOSPlugin["type"]): ContentOSPlugin[] {
    return this.list().filter((p) => p.plugin.type === type).map((p) => p.plugin);
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
}

export const pluginRegistry = new PluginRegistry();
