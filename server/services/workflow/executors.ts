import path from "path";
import {
  executeAgentDefinition,
  executeEphemeralAgent,
  findActiveAgentByRole,
} from "../agent/runtime";
import type { WorkflowNode } from "./types";
import { pythonBridge } from "../python/bridge";

export type StepContext = {
  organizationId: string;
  workflowRunId: string;
  stepRunId: string;
  runInput: Record<string, unknown>;
  /** Outputs keyed by completed parent node id. */
  parentOutputs: Record<string, unknown>;
  node: WorkflowNode;
};

function deepGet(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Replace {{input.x}} and {{nodes.nodeId.field}} in strings. */
export function interpolate(template: string, ctx: StepContext): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const key = expr.trim();
    if (key.startsWith("input.")) {
      const v = deepGet(ctx.runInput, key.slice("input.".length));
      return v == null ? "" : String(v);
    }
    if (key.startsWith("nodes.")) {
      const rest = key.slice("nodes.".length);
      const [nodeId, ...path] = rest.split(".");
      const base = ctx.parentOutputs[nodeId!];
      const v = path.length ? deepGet(base, path.join(".")) : base;
      return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    }
    return "";
  });
}

function interpolateValue(value: unknown, ctx: StepContext): unknown {
  if (typeof value === "string") return interpolate(value, ctx);
  if (Array.isArray(value)) return value.map((v) => interpolateValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateValue(v, ctx);
    }
    return out;
  }
  return value;
}

export type StepResult =
  | { status: "completed"; output: unknown; decisionSummary?: string }
  | { status: "awaiting_approval"; output: unknown; decisionSummary?: string }
  | { status: "skipped"; output?: unknown; decisionSummary?: string };

export async function executeNode(ctx: StepContext): Promise<StepResult> {
  const { node } = ctx;
  switch (node.type) {
    case "trigger.manual":
      return {
        status: "completed",
        output: { triggered: true, input: ctx.runInput },
        decisionSummary: "Manual trigger accepted run input",
      };

    case "logic.transform": {
      const template = node.config.template ?? { ...ctx.runInput, ...ctx.parentOutputs };
      const output = interpolateValue(template, ctx);
      return {
        status: "completed",
        output,
        decisionSummary: "Transformed inputs via template",
      };
    }

    case "logic.condition": {
      const expression = String(node.config.expression ?? "true");
      const resolved = interpolate(expression, ctx);
      // Minimal safe eval: only allow true/false/1/0/"yes"/"no" after interpolate,
      // or equality checks like `value==foo`.
      let pass = false;
      if (/^(true|1|yes)$/i.test(resolved.trim())) pass = true;
      else if (/^(false|0|no|)$/i.test(resolved.trim())) pass = false;
      else if (resolved.includes("==")) {
        const [l, r] = resolved.split("==").map((s) => s.trim());
        pass = l === r;
      } else {
        pass = Boolean(resolved);
      }
      return {
        status: "completed",
        output: { pass, expression: resolved },
        decisionSummary: `Condition evaluated to ${pass}`,
      };
    }

    case "logic.delay": {
      // Delay is handled by the scheduler via job delay; executor is a no-op marker.
      const delayMs = Number(node.config.delayMs ?? 0);
      return {
        status: "completed",
        output: { delayedMs: delayMs },
        decisionSummary: `Delay of ${delayMs}ms elapsed`,
      };
    }

    case "logic.merge": {
      return {
        status: "completed",
        output: { merged: ctx.parentOutputs },
        decisionSummary: "Merged parent branch outputs",
      };
    }

    case "human.approval": {
      return {
        status: "awaiting_approval",
        output: {
          summary: interpolate(String(node.config.summary ?? node.name), ctx),
          parents: ctx.parentOutputs,
        },
        decisionSummary: "Waiting for human approval",
      };
    }

    case "agent.task": {
      const prompt = interpolate(String(node.config.prompt ?? "{{input.goal}}"), ctx);
      const configuredId =
        typeof node.config.agentDefinitionId === "string" && node.config.agentDefinitionId
          ? node.config.agentDefinitionId
          : null;
      const roleHint =
        typeof node.config.agentRole === "string" && node.config.agentRole
          ? node.config.agentRole
          : null;

      let agentDefinitionId = configuredId;
      if (!agentDefinitionId && roleHint) {
        const byRole = await findActiveAgentByRole(ctx.organizationId, roleHint);
        agentDefinitionId = byRole?.id ?? null;
      }

      const result = agentDefinitionId
        ? await executeAgentDefinition({
            organizationId: ctx.organizationId,
            agentDefinitionId,
            prompt,
            workflowRunId: ctx.workflowRunId,
            workflowStepRunId: ctx.stepRunId,
          })
        : await executeEphemeralAgent({
            organizationId: ctx.organizationId,
            prompt,
            workflowRunId: ctx.workflowRunId,
            workflowStepRunId: ctx.stepRunId,
          });

      return {
        status: "completed",
        output: {
          text: result.text,
          prompt,
          executionId: result.executionId,
          agentDefinitionId,
          provider: result.provider,
          model: result.model,
          capabilities: result.capabilities,
          allowedTools: result.allowedTools,
        },
        decisionSummary: result.decisionSummary,
      };
    }

    case "video.script": {
      const { generateYoutubeScript } = await import("../youtube/studio");
      const topic = interpolate(
        String(node.config.topic ?? ctx.runInput.topic ?? ctx.runInput.goal ?? ""),
        ctx,
      );
      if (!topic.trim()) {
        throw new Error("video.script requires topic (config.topic or input.topic/goal)");
      }
      const script = await generateYoutubeScript({
        organizationId: ctx.organizationId,
        topic,
        tone: node.config.tone ? interpolate(String(node.config.tone), ctx) : undefined,
        lengthMinutes: Number(node.config.lengthMinutes ?? 10),
        workflowRunId: ctx.workflowRunId,
        stepRunId: ctx.stepRunId,
      });
      return {
        status: "completed",
        output: script,
        decisionSummary: `Scripted: ${String(script.title ?? topic).slice(0, 80)}`,
      };
    }

    case "video.compliance": {
      const { runComplianceScan } = await import("../youtube/studio");
      const fromNode = String(node.config.fromNode ?? "");
      const parent = fromNode ? ctx.parentOutputs[fromNode] : Object.values(ctx.parentOutputs)[0];
      const text =
        typeof parent === "object" && parent && "fullScript" in parent
          ? String((parent as { fullScript: unknown }).fullScript)
          : typeof parent === "object" && parent && "text" in parent
            ? String((parent as { text: unknown }).text)
            : JSON.stringify(parent ?? "");
      const scan = runComplianceScan(text);
      if (!scan.ok) {
        return {
          status: "awaiting_approval",
          output: { ...scan, scriptPreview: text.slice(0, 500) },
          decisionSummary: scan.notes,
        };
      }
      return {
        status: "completed",
        output: scan,
        decisionSummary: scan.notes,
      };
    }

    case "video.voice": {
      const { synthesizeVoice } = await import("../youtube/studio");
      const { repoRoot } = await import("../ide/repoFs");
      const fromNode = String(node.config.fromNode ?? "script");
      const parent = ctx.parentOutputs[fromNode] as Record<string, unknown> | undefined;
      const scriptText = String(parent?.fullScript ?? parent?.text ?? "");
      if (!scriptText.trim()) throw new Error("video.voice: no script text from parent node");
      const outDir = `${repoRoot()}/.artifacts/youtube/${ctx.workflowRunId}`;
      const voice = await synthesizeVoice({
        script: scriptText,
        outputDir: outDir,
        voiceId: node.config.voiceId ? String(node.config.voiceId) : undefined,
      });
      return {
        status: "completed",
        output: voice,
        decisionSummary: `Voice via ${voice.provider}`,
      };
    }

    case "video.broll": {
      const { fetchRoyaltyFreeBroll } = await import("../youtube/studio");
      const fromNode = String(node.config.fromNode ?? "script");
      const parent = ctx.parentOutputs[fromNode] as Record<string, unknown> | undefined;
      const sections = Array.isArray(parent?.sections) ? parent!.sections : [];
      const keywords: string[] = [];
      for (const s of sections) {
        if (s && typeof s === "object" && "brollNotes" in s) {
          const notes = (s as { brollNotes?: unknown }).brollNotes;
          if (Array.isArray(notes)) keywords.push(...notes.map(String));
        }
        if (s && typeof s === "object" && "heading" in s) {
          keywords.push(String((s as { heading: unknown }).heading));
        }
      }
      if (!keywords.length) {
        keywords.push(String(parent?.title ?? ctx.runInput.topic ?? "technology"), "abstract");
      }
      try {
        const clips = await fetchRoyaltyFreeBroll({ keywords });
        return {
          status: "completed",
          output: { clips, urls: clips.map((c) => c.url) },
          decisionSummary: `Fetched ${clips.length} Pexels clips`,
        };
      } catch (err) {
        // continue strategy at graph level may skip; still surface clear error output
        return {
          status: "completed",
          output: {
            clips: [],
            urls: [],
            warning: err instanceof Error ? err.message : String(err),
          },
          decisionSummary: "B-roll unavailable — assemble will fall back to generated stills",
        };
      }
    }

    case "video.assemble": {
      const { assembleVideo } = await import("../youtube/studio");
      const { repoRoot } = await import("../ide/repoFs");
      const scriptNode = String(node.config.scriptNode ?? "script");
      const voiceNode = String(node.config.voiceNode ?? "voice");
      const brollNode = String(node.config.brollNode ?? "broll");
      const script = ctx.parentOutputs[scriptNode] as Record<string, unknown> | undefined;
      const voice = ctx.parentOutputs[voiceNode] as { audioPath?: string } | undefined;
      const broll = ctx.parentOutputs[brollNode] as { urls?: string[] } | undefined;
      if (!voice?.audioPath) throw new Error("video.assemble: missing voice.audioPath");
      const outDir = `${repoRoot()}/.artifacts/youtube/${ctx.workflowRunId}`;
      const assembled = await assembleVideo({
        outputDir: outDir,
        scriptTitle: String(script?.title ?? "YouTube video"),
        audioPath: voice.audioPath,
        brollUrls: broll?.urls,
        fallbackImagePrompts: [
          `Cinematic cover for ${String(script?.title ?? "video")}`,
          `B-roll mood for ${String(script?.hook ?? script?.title ?? "topic")}`,
        ],
      });
      return {
        status: "completed",
        output: assembled,
        decisionSummary: `Assembled via ${assembled.method}`,
      };
    }

    case "youtube.upload": {
      const { uploadVideoForChannel, listChannels, createVideoDraft } = await import("../youtube/studio");
      const assembleNode = String(node.config.assembleNode ?? "assemble");
      const scriptNode = String(node.config.scriptNode ?? "script");
      const assembled = ctx.parentOutputs[assembleNode] as { videoPath?: string } | undefined;
      const script = ctx.parentOutputs[scriptNode] as Record<string, unknown> | undefined;
      if (!assembled?.videoPath) throw new Error("youtube.upload: missing assembled videoPath");

      const channels = await listChannels(ctx.organizationId);
      const channelId =
        (typeof node.config.channelId === "string" && node.config.channelId) ||
        (typeof ctx.runInput.channelId === "string" && ctx.runInput.channelId) ||
        channels[0]?.id;
      if (!channelId) {
        throw new Error(
          "youtube.upload: no youtube_channels row for org — bind a channel in YouTube Studio first",
        );
      }

      const title = String(script?.title ?? ctx.runInput.title ?? "Untitled upload").slice(0, 100);
      const description = String(script?.fullScript ?? script?.cta ?? "").slice(0, 5000);
      const draftId = await createVideoDraft({
        organizationId: ctx.organizationId,
        channelId,
        title,
        topic: String(ctx.runInput.topic ?? ""),
        workflowRunId: ctx.workflowRunId,
      });

      const uploaded = await uploadVideoForChannel({
        organizationId: ctx.organizationId,
        channelRowId: channelId,
        videoPath: assembled.videoPath,
        title,
        description,
        privacyStatus: (node.config.privacyStatus as "private" | "unlisted" | "public") ?? "private",
        youtubeVideoRowId: draftId,
        workflowRunId: ctx.workflowRunId,
      });

      return {
        status: "completed",
        output: uploaded,
        decisionSummary: `Uploaded ${uploaded.youtubeVideoId}`,
      };
    }

    case "output.return": {
      const pick = node.config.fromNode ? ctx.parentOutputs[String(node.config.fromNode)] : ctx.parentOutputs;
      return {
        status: "completed",
        output: pick ?? ctx.parentOutputs,
        decisionSummary: "Collected workflow output",
      };
    }

    case "output.notify": {
      // Real notify adapters land later — record intent only, never fake delivery.
      return {
        status: "completed",
        output: {
          notified: false,
          reason: "Not configured — no notify adapter (email/webhook) bound",
          message: interpolate(String(node.config.message ?? ""), ctx),
        },
        decisionSummary: "Notify skipped: adapter not configured",
      };
    }

    case "python.caption": {
      const fromNode = String(node.config.fromNode ?? "assemble");
      const parent = ctx.parentOutputs[fromNode] as Record<string, unknown> | undefined;
      const videoPath = String(parent?.videoPath ?? "");
      if (!videoPath) throw new Error("python.caption: missing videoPath from parent node");
      try {
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(videoPath);
        const result = await pythonBridge.generateCaptions(buffer, path.basename(videoPath));
        return {
          status: "completed",
          output: result,
          decisionSummary: `Generated ${result.segments.length} caption segments`,
        };
      } catch (err) {
        return {
          status: "completed",
          output: { warning: err instanceof Error ? err.message : String(err), srt: "" },
          decisionSummary: "Caption generation failed — continuing without captions",
        };
      }
    }

    case "python.audio.analyze": {
      const fromNode = String(node.config.fromNode ?? "voice");
      const parent = ctx.parentOutputs[fromNode] as Record<string, unknown> | undefined;
      const audioPath = String(parent?.audioPath ?? "");
      if (!audioPath) throw new Error("python.audio.analyze: missing audioPath from parent node");
      try {
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(audioPath);
        const result = await pythonBridge.analyzeAudio(buffer, path.basename(audioPath));
        return {
          status: "completed",
          output: result,
          decisionSummary: `Detected ${result.bpm} BPM`,
        };
      } catch (err) {
        return {
          status: "completed",
          output: { warning: err instanceof Error ? err.message : String(err), bpm: null, beats: [] },
          decisionSummary: "Audio analysis failed",
        };
      }
    }

    case "python.thumbnail.score": {
      const fromNode = String(node.config.fromNode ?? "");
      const parent = fromNode ? ctx.parentOutputs[fromNode] : Object.values(ctx.parentOutputs)[0];
      const imagePath =
        typeof parent === "object" && parent && "thumbnailPath" in parent
          ? String((parent as { thumbnailPath?: string }).thumbnailPath ?? "")
          : typeof parent === "object" && parent && "imagePath" in parent
            ? String((parent as { imagePath?: string }).imagePath ?? "")
            : "";
      if (!imagePath) throw new Error("python.thumbnail.score: missing imagePath from parent node");
      try {
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(imagePath);
        const result = await pythonBridge.scoreThumbnail(buffer, path.basename(imagePath));
        return {
          status: "completed",
          output: result,
          decisionSummary: `Thumbnail scored ${result.score}/100 (${result.emotion})`,
        };
      } catch (err) {
        return {
          status: "completed",
          output: { warning: err instanceof Error ? err.message : String(err), score: 0, emotion: "error" },
          decisionSummary: "Thumbnail scoring failed",
        };
      }
    }

    case "python.virality.check": {
      const fromNode = String(node.config.fromNode ?? "script");
      const parent = ctx.parentOutputs[fromNode] as Record<string, unknown> | undefined;
      const scriptText = String(parent?.fullScript ?? parent?.text ?? JSON.stringify(parent ?? ""));
      if (!scriptText.trim()) throw new Error("python.virality.check: missing script text from parent node");
      try {
        const result = await pythonBridge.checkViralityScore({ fullScript: scriptText });
        if (result.similarity_score < 0.7 && node.config.abortBelowScore !== false) {
          return {
            status: "awaiting_approval",
            output: result,
            decisionSummary: `Virality score ${result.similarity_score} below threshold 0.7 — manual review recommended`,
          };
        }
        return {
          status: "completed",
          output: result,
          decisionSummary: `Virality score ${result.similarity_score}`,
        };
      } catch (err) {
        return {
          status: "completed",
          output: { warning: err instanceof Error ? err.message : String(err), similarity_score: 0 },
          decisionSummary: "Virality check failed — proceeding without score",
        };
      }
    }

    default:
      return {
        status: "skipped",
        output: { error: `Unsupported node type` },
        decisionSummary: `Node type not implemented`,
      };
  }
}
