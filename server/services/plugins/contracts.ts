import type { PluginManifest, PluginCapabilities } from "./registry";

export interface AiProviderPlugin {
  type: "ai_provider";
  manifest: PluginManifest;
  capabilities: PluginCapabilities;

  complete(params: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
  }): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>;

  stream?(params: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): AsyncIterable<string>;

  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number; model?: string }>;
}

export interface PublishingTargetPlugin {
  type: "publishing_target";
  manifest: PluginManifest;
  capabilities: PluginCapabilities;

  publish(params: {
    title: string;
    description: string;
    tags: string[];
    videoFile: Buffer;
    thumbnailFile?: Buffer;
    scheduledAt?: Date;
  }): Promise<{ id: string; url: string; status: string }>;

  updateMetadata?(params: { id: string; title?: string; description?: string; tags?: string[] }): Promise<void>;
  delete?(id: string): Promise<void>;
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

export interface StorageAdapterPlugin {
  type: "storage_adapter";
  manifest: PluginManifest;
  capabilities: PluginCapabilities;

  put(params: { key: string; body: Buffer; contentType: string; expiresIn?: number }): Promise<{ url: string }>;
  get?(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete?(key: string): Promise<void>;
  list?(prefix?: string): Promise<{ key: string; size: number; lastModified: Date }[]>;
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

export type ContentOSPlugin = AiProviderPlugin | PublishingTargetPlugin | StorageAdapterPlugin;
