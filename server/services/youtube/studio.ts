/**
 * YouTube Studio services — script, voice, b-roll, assemble, compliance, upload, trends.
 * White-hat: human noise in scripts, royalty-free B-roll only, compliance before upload.
 */
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { env } from "../../_core/env";
import { youtubeChannels, youtubeTrends, youtubeVideos } from "../../../drizzle/schema";
import { executeAgentDefinition, findActiveAgentByRole, createAgentWithVersion } from "../agent/runtime";
import { generateVoiceover } from "../media/streamElementsTTS";
import { concatClips, imageToKenBurnsClip, muxAudioOntoVideo } from "../media/ffmpeg";
import { generateImage } from "../media/pollinationsImage";
import { writeAuditLog } from "../../_core/auth/audit";
import { safeJsonStringify } from "../../_core/redact";

const DEMONETIZE_HINTS = [
  /\b(buy followers|guaranteed income|get rich quick)\b/i,
  /\b(miracle cure|cure cancer|fda approved secret)\b/i,
  /\b(free robux|hack someone'?s account)\b/i,
  /\b(underage|child porn)\b/i,
];

const HUMAN_NOISE_SEEDS = [
  "Last Tuesday at a coffee shop in Austin",
  "A friend who ships firmware in Berlin told me",
  "In March 2024 I tried this on a spare laptop",
  "My cousin who edits docs for a living asked",
  "On a delayed flight to Chicago I sketched this",
];

export const YOUTUBE_SCRIPTWRITER_ROLE = "youtube_scriptwriter";

export const SCRIPTWRITER_SYSTEM = `You are a YouTube Scriptwriter for long-form (8–15 min) educational/entertainment videos.
HARD RULES:
1) Open with a 5-second hook (one vivid sentence).
2) Structure: Problem → Solution → Result, with clear section headers.
3) Place a soft CTA near the 90% mark (subscribe / comment prompt) — not earlier.
4) Include B-roll timing notes like [B-ROLL 0:45 city street].
5) Inject unique "human noise": one specific anecdote, date, or regional detail (never reuse the same stock phrase).
6) Never invent statistics or accuracy percentages. If unsure, say so.
7) Output STRICT JSON:
{"title":"...","hook":"...","sections":[{"heading":"...","script":"...","brollNotes":["..."]}],"cta":"...","fullScript":"...","estimatedMinutes":10}`;

export async function ensureYoutubeScriptwriterAgent(organizationId: string, userId?: string) {
  const existing = await findActiveAgentByRole(organizationId, YOUTUBE_SCRIPTWRITER_ROLE);
  if (existing) return existing;

  let actor = userId;
  if (!actor) {
    const { organizationMembers } = await import("../../../drizzle/schema");
    const [member] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))
      .limit(1);
    actor = member?.userId;
  }
  if (!actor) {
    throw new Error("Cannot bootstrap YouTube Scriptwriter — org has no members");
  }

  await createAgentWithVersion({
    organizationId,
    userId: actor,
    name: "YouTube Scriptwriter",
    role: YOUTUBE_SCRIPTWRITER_ROLE,
    description: "Long-form retention scripts with hook / PSR / CTA structure",
    systemPrompt: SCRIPTWRITER_SYSTEM,
    capabilities: ["research", "write"],
    allowedTools: [],
    activate: true,
  });
  const created = await findActiveAgentByRole(organizationId, YOUTUBE_SCRIPTWRITER_ROLE);
  if (!created) throw new Error("Failed to activate YouTube Scriptwriter agent");
  return created;
}

function pickNoise(): string {
  return HUMAN_NOISE_SEEDS[Math.floor(Math.random() * HUMAN_NOISE_SEEDS.length)]!;
}

export async function generateYoutubeScript(params: {
  organizationId: string;
  topic: string;
  tone?: string;
  lengthMinutes?: number;
  workflowRunId?: string;
  stepRunId?: string;
  userId?: string;
}) {
  await ensureYoutubeScriptwriterAgent(params.organizationId, params.userId);
  const agent = await findActiveAgentByRole(params.organizationId, YOUTUBE_SCRIPTWRITER_ROLE);
  const noise = pickNoise();
  const prompt = [
    `Topic: ${params.topic}`,
    `Tone: ${params.tone ?? "curious, clear, non-hype"}`,
    `Target length: ${params.lengthMinutes ?? 10} minutes`,
    `Human noise seed (must weave in naturally): ${noise}`,
    `Return JSON only.`,
  ].join("\n");

  if (!agent) {
    throw new Error("YouTube Scriptwriter agent missing after ensure");
  }

  const result = await executeAgentDefinition({
    organizationId: params.organizationId,
    agentDefinitionId: agent.id,
    prompt,
    workflowRunId: params.workflowRunId,
    workflowStepRunId: params.stepRunId,
  });

  let parsed: Record<string, unknown> = { fullScript: result.text, raw: result.text };
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    /* keep raw */
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title : undefined,
    hook: parsed.hook,
    sections: parsed.sections,
    cta: parsed.cta,
    fullScript: typeof parsed.fullScript === "string" ? parsed.fullScript : result.text,
    estimatedMinutes: parsed.estimatedMinutes,
    humanNoise: noise,
    executionId: result.executionId,
    text: result.text,
    provider: result.provider,
    model: result.model,
  };
}

export function runComplianceScan(scriptText: string): {
  ok: boolean;
  hits: string[];
  notes: string;
} {
  const hits: string[] = [];
  for (const re of DEMONETIZE_HINTS) {
    const m = scriptText.match(re);
    if (m) hits.push(m[0]);
  }
  return {
    ok: hits.length === 0,
    hits,
    notes:
      hits.length === 0
        ? "Compliance scan passed (heuristic keyword filter — not legal advice)"
        : `Compliance hold: flagged phrases ${hits.join(", ")}`,
  };
}

export async function synthesizeVoice(params: {
  script: string;
  outputDir: string;
  voiceId?: string;
}): Promise<{ audioPath: string; provider: string }> {
  await fs.mkdir(params.outputDir, { recursive: true });
  const audioPath = path.join(params.outputDir, `voice-${Date.now()}.mp3`);

  if (env.ELEVENLABS_API_KEY) {
    const voice = params.voiceId || env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: params.script.slice(0, 4500),
        model_id: "eleven_multilingual_v2",
      }),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
    }
    await fs.writeFile(audioPath, Buffer.from(await res.arrayBuffer()) as Uint8Array);
    return { audioPath, provider: "elevenlabs" };
  }

  // Free fallback — StreamElements (real HTTP TTS, rate-limited)
  await generateVoiceover({
    text: params.script.slice(0, 2500),
    outputPath: audioPath,
    voice: params.voiceId || "Brian",
  });
  return { audioPath, provider: "streamelements" };
}

export type BrollClip = {
  url: string;
  photographer?: string;
  license: "pexels" | "pixabay";
  keyword: string;
};

export async function fetchRoyaltyFreeBroll(params: {
  keywords: string[];
  perKeyword?: number;
}): Promise<BrollClip[]> {
  if (!env.PEXELS_API_KEY) {
    throw new Error(
      "PEXELS_API_KEY not configured — video.broll requires a real Pexels API key (royalty-free). Set it in .env.",
    );
  }
  const clips: BrollClip[] = [];
  const limit = params.perKeyword ?? 2;
  for (const keyword of params.keywords.slice(0, 6)) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=${limit}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: env.PEXELS_API_KEY },
    });
    if (!res.ok) {
      throw new Error(`Pexels search failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      videos?: Array<{
        user?: { name?: string };
        video_files?: Array<{ link?: string; width?: number }>;
      }>;
    };
    for (const v of data.videos ?? []) {
      const file =
        (v.video_files ?? [])
          .filter((f) => f.link && (f.width ?? 0) >= 1280)
          .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0] ?? v.video_files?.[0];
      if (file?.link) {
        clips.push({
          url: file.link,
          photographer: v.user?.name,
          license: "pexels",
          keyword,
        });
      }
    }
  }
  if (!clips.length) {
    throw new Error("Pexels returned no licensed clips for keywords");
  }
  return clips;
}

export async function assembleVideo(params: {
  outputDir: string;
  scriptTitle: string;
  audioPath: string;
  brollUrls?: string[];
  /** When no b-roll, generate stills via Pollinations + Ken Burns */
  fallbackImagePrompts?: string[];
}): Promise<{ videoPath: string; method: string }> {
  await fs.mkdir(params.outputDir, { recursive: true });
  const videoPath = path.join(params.outputDir, `assembled-${Date.now()}.mp4`);

  // Prefer downloading a few b-roll clips; otherwise Ken Burns from generated stills.
  const clipPaths: string[] = [];
  if (params.brollUrls?.length) {
    for (let i = 0; i < Math.min(params.brollUrls.length, 4); i++) {
      const dest = path.join(params.outputDir, `broll-${i}.mp4`);
      const res = await fetch(params.brollUrls[i]!);
      if (!res.ok) continue;
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()) as Uint8Array);
      clipPaths.push(dest);
    }
  }

  if (!clipPaths.length) {
    const prompts = params.fallbackImagePrompts?.length
      ? params.fallbackImagePrompts
      : [`Cinematic still for: ${params.scriptTitle}`, `Abstract tech background for: ${params.scriptTitle}`];
    for (let i = 0; i < prompts.length; i++) {
      const img = path.join(params.outputDir, `still-${i}.jpg`);
      await generateImage({ prompt: prompts[i]!, outputPath: img });
      const clip = path.join(params.outputDir, `kb-${i}.mp4`);
      await imageToKenBurnsClip({ imagePath: img, outputPath: clip, durationSeconds: 8 });
      clipPaths.push(clip);
    }
  }

  if (clipPaths.length > 1) {
    const concatPath = path.join(params.outputDir, `concat-${Date.now()}.mp4`);
    await concatClips(clipPaths, concatPath);
    await muxAudioOntoVideo({ videoPath: concatPath, audioPath: params.audioPath, outputPath: videoPath });
    return { videoPath, method: "broll-or-kenburns+mux" };
  }

  await muxAudioOntoVideo({
    videoPath: clipPaths[0]!,
    audioPath: params.audioPath,
    outputPath: videoPath,
  });
  return { videoPath, method: "single-clip+mux" };
}

export async function upsertChannel(params: {
  organizationId: string;
  channelName: string;
  youtubeChannelId?: string;
  accessTokenEnvKey: string;
  refreshTokenEnvKey?: string;
  timezone?: string;
  niche?: string;
  userAgent?: string;
  isActive?: boolean;
}) {
  const existing = await db
    .select()
    .from(youtubeChannels)
    .where(eq(youtubeChannels.organizationId, params.organizationId))
    .limit(1);
  const ua =
    params.userAgent ??
    `WorkerAgentStudio/1.0 (+org/${params.organizationId.slice(0, 8)}; channel/${params.channelName.replace(/\W+/g, "-").slice(0, 24)})`;

  if (existing[0]) {
    await db
      .update(youtubeChannels)
      .set({
        channelName: params.channelName,
        youtubeChannelId: params.youtubeChannelId ?? existing[0].youtubeChannelId,
        accessTokenEnvKey: params.accessTokenEnvKey,
        refreshTokenEnvKey: params.refreshTokenEnvKey ?? existing[0].refreshTokenEnvKey,
        timezone: params.timezone ?? existing[0].timezone,
        niche: params.niche ?? existing[0].niche,
        userAgent: ua,
        isActive: params.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(youtubeChannels.id, existing[0].id));
    return existing[0].id;
  }

  const id = randomUUID();
  await db.insert(youtubeChannels).values({
    id,
    organizationId: params.organizationId,
    channelName: params.channelName,
    youtubeChannelId: params.youtubeChannelId ?? null,
    accessTokenEnvKey: params.accessTokenEnvKey,
    refreshTokenEnvKey: params.refreshTokenEnvKey ?? null,
    timezone: params.timezone ?? "UTC",
    userAgent: ua,
    isActive: params.isActive ?? true,
    niche: params.niche ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function listChannels(organizationId: string) {
  return db
    .select()
    .from(youtubeChannels)
    .where(eq(youtubeChannels.organizationId, organizationId))
    .orderBy(desc(youtubeChannels.updatedAt));
}

export async function listVideos(organizationId: string, limit = 40) {
  return db
    .select()
    .from(youtubeVideos)
    .where(eq(youtubeVideos.organizationId, organizationId))
    .orderBy(desc(youtubeVideos.createdAt))
    .limit(limit);
}

function resolveEnvSecret(envKey: string): string | null {
  const v = process.env[envKey];
  return v && v.trim() ? v.trim() : null;
}

export async function uploadVideoForChannel(params: {
  organizationId: string;
  channelRowId: string;
  videoPath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
  youtubeVideoRowId?: string;
  workflowRunId?: string;
}): Promise<{ youtubeVideoId: string; url: string }> {
  const [channel] = await db
    .select()
    .from(youtubeChannels)
    .where(
      and(
        eq(youtubeChannels.id, params.channelRowId),
        eq(youtubeChannels.organizationId, params.organizationId),
      ),
    )
    .limit(1);
  if (!channel) throw new Error("YouTube channel binding not found for organization");
  if (!channel.isActive) throw new Error("Channel is inactive");

  const token = resolveEnvSecret(channel.accessTokenEnvKey);
  if (!token) {
    throw new Error(
      `OAuth access token missing — set env ${channel.accessTokenEnvKey} for channel ${channel.channelName}`,
    );
  }

  const videoBuffer = await fs.readFile(params.videoPath);
  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description: params.description.slice(0, 5000),
      tags: params.tags ?? [],
      ...(channel.youtubeChannelId ? { channelId: channel.youtubeChannelId } : {}),
    },
    status: {
      privacyStatus: params.privacyStatus ?? "private",
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = "wa_yt_upload_boundary";
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    ) as any,
    videoBuffer as any,
    Buffer.from(`\r\n--${boundary}--`) as any,
  ]) as unknown as Uint8Array<ArrayBuffer>;

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "User-Agent": channel.userAgent ?? "WorkerAgentStudio/1.0",
      },
      body: multipartBody,
    },
  );

  if (!response.ok) {
    throw new Error(`YouTube upload failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { id: string };
  const url = `https://youtube.com/watch?v=${data.id}`;

  if (params.youtubeVideoRowId) {
    await db
      .update(youtubeVideos)
      .set({
        youtubeVideoId: data.id,
        status: "uploaded",
        uploadedAt: new Date(),
        localVideoPath: params.videoPath,
        workflowRunId: params.workflowRunId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(youtubeVideos.id, params.youtubeVideoRowId));
  }

  await writeAuditLog({
    organizationId: params.organizationId,
    action: "youtube.upload",
    resourceType: "youtube_video",
    resourceId: data.id,
    payload: { channelId: channel.id, title: params.title },
  });

  return { youtubeVideoId: data.id, url };
}

/** Stagger upload time into the channel timezone evening window. */
export function computeStaggeredSchedule(timezone: string, offsetMinutes = 0): Date {
  const now = new Date();
  // Approximate: schedule ~18:00 local as UTC offset guess via Intl
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = Number(fmt.format(now));
    const target = new Date(now.getTime());
    const deltaHours = (18 - hour + 24) % 24 || 24;
    target.setTime(now.getTime() + deltaHours * 3600_000 + offsetMinutes * 60_000);
    return target;
  } catch {
    return new Date(now.getTime() + (2 + offsetMinutes) * 60_000);
  }
}

export async function searchTrends(params: {
  organizationId: string;
  query: string;
}): Promise<{ id: string; results: unknown[] }> {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY not set — trend search uses YouTube Data API v3 search.list (real). Configure .env.",
    );
  }
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10` +
    `&q=${encodeURIComponent(params.query)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string; description?: string };
    }>;
  };
  const results = (data.items ?? []).map((it) => ({
    videoId: it.id?.videoId,
    title: it.snippet?.title,
    channelTitle: it.snippet?.channelTitle,
    publishedAt: it.snippet?.publishedAt,
    description: it.snippet?.description?.slice(0, 240),
  }));

  const id = randomUUID();
  await db.insert(youtubeTrends).values({
    id,
    organizationId: params.organizationId,
    query: params.query,
    resultsJson: safeJsonStringify(results),
    source: "youtube_data_api",
    fetchedAt: new Date(),
    createdAt: new Date(),
  });
  return { id, results };
}

export async function createVideoDraft(params: {
  organizationId: string;
  channelId: string;
  title: string;
  topic?: string;
  workflowRunId?: string;
}) {
  const id = randomUUID();
  await db.insert(youtubeVideos).values({
    id,
    organizationId: params.organizationId,
    channelId: params.channelId,
    title: params.title,
    topic: params.topic ?? null,
    workflowRunId: params.workflowRunId ?? null,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function listRecentTrends(organizationId: string, limit = 20) {
  return db
    .select()
    .from(youtubeTrends)
    .where(eq(youtubeTrends.organizationId, organizationId))
    .orderBy(desc(youtubeTrends.fetchedAt))
    .limit(limit);
}
