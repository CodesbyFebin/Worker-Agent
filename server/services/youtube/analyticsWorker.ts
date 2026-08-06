/**
 * Adaptive optimizer — every 6h, inspect recent uploads and tighten scriptwriter pacing
 * when avg view duration is weak. Uses YouTube Data API videos.list when OAuth is available.
 * Never invents metrics; without Analytics API scope, avgViewDuration stays null.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Queue } from "bullmq";
import { connection, registerWorker } from "../../_core/queue";
import { db } from "../../_core/db";
import {
  agentDefinitions,
  agentVersions,
  promptVersions,
  youtubeChannels,
  youtubeVideos,
} from "../../../drizzle/schema";
import { YOUTUBE_SCRIPTWRITER_ROLE } from "./studio";
import { writeAuditLog } from "../../_core/auth/audit";

export const ANALYTICS_QUEUE = "youtube-analytics";

export const analyticsQueue = new Queue(ANALYTICS_QUEUE, { connection });

function resolveEnvSecret(envKey: string): string | null {
  const v = process.env[envKey];
  return v && v.trim() ? v.trim() : null;
}

async function fetchVideoStats(accessToken: string, videoId: string, userAgent?: string | null) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": userAgent ?? "WorkerAgentStudio/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`videos.list failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      statistics?: { viewCount?: string };
    }>;
  };
  const views = Number(data.items?.[0]?.statistics?.viewCount ?? 0);
  return { views, avgViewDuration: null as number | null };
}

async function appendPacingHint(organizationId: string) {
  const [agent] = await db
    .select()
    .from(agentDefinitions)
    .where(
      and(
        eq(agentDefinitions.organizationId, organizationId),
        eq(agentDefinitions.role, YOUTUBE_SCRIPTWRITER_ROLE),
        eq(agentDefinitions.status, "active"),
      ),
    )
    .limit(1);
  if (!agent?.currentVersionId) return false;

  const [ver] = await db
    .select()
    .from(agentVersions)
    .where(eq(agentVersions.id, agent.currentVersionId))
    .limit(1);
  if (!ver) return false;

  const [pv] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, ver.promptVersionId))
    .limit(1);
  if (!pv) return false;

  const hint =
    "\n\nADAPTIVE HINT (auto): Recent uploads show weak early retention — shorten intros by ~5 seconds and move the first payoff earlier.";
  if (pv.systemPrompt.includes("ADAPTIVE HINT")) return false;

  const newPvId = randomUUID();
  await db.insert(promptVersions).values({
    id: newPvId,
    promptId: pv.promptId,
    organizationId,
    version: pv.version + 1,
    systemPrompt: pv.systemPrompt + hint,
    changeSummary: "Auto pacing hint from analytics loop",
    createdBy: pv.createdBy,
  });

  const newAgentVerId = randomUUID();
  await db.insert(agentVersions).values({
    id: newAgentVerId,
    agentId: agent.id,
    organizationId,
    version: ver.version + 1,
    promptVersionId: newPvId,
    modelPolicyId: ver.modelPolicyId,
    toolPolicyId: ver.toolPolicyId,
    capabilities: ver.capabilities,
    changeSummary: "Analytics-driven pacing adjustment",
    createdBy: ver.createdBy,
  });
  await db
    .update(agentDefinitions)
    .set({ currentVersionId: newAgentVerId, updatedAt: new Date() })
    .where(eq(agentDefinitions.id, agent.id));

  await writeAuditLog({
    organizationId,
    action: "youtube.analytics_prompt_adjust",
    resourceType: "agent_definition",
    resourceId: agent.id,
    payload: { reason: "avg_view_duration_below_threshold" },
  });
  return true;
}

export async function runAnalyticsPass(): Promise<{ orgs: number; updated: number }> {
  const channels = await db.select().from(youtubeChannels).where(eq(youtubeChannels.isActive, true));
  let updated = 0;
  const orgs = new Set<string>();

  for (const ch of channels) {
    orgs.add(ch.organizationId);
    const token = resolveEnvSecret(ch.accessTokenEnvKey);
    if (!token) continue;

    const videos = await db
      .select()
      .from(youtubeVideos)
      .where(
        and(
          eq(youtubeVideos.channelId, ch.id),
          eq(youtubeVideos.status, "uploaded"),
          isNotNull(youtubeVideos.youtubeVideoId),
        ),
      )
      .orderBy(desc(youtubeVideos.uploadedAt))
      .limit(10);

    let weak = 0;
    for (const v of videos) {
      if (!v.youtubeVideoId) continue;
      try {
        const stats = await fetchVideoStats(token, v.youtubeVideoId, ch.userAgent);
        await db
          .update(youtubeVideos)
          .set({
            views: stats.views,
            avgViewDuration:
              stats.avgViewDuration != null ? String(stats.avgViewDuration) : v.avgViewDuration,
            updatedAt: new Date(),
          })
          .where(eq(youtubeVideos.id, v.id));
        const avg = v.avgViewDuration != null ? Number(v.avgViewDuration) : null;
        if (avg != null && avg < 0.6) weak += 1;
      } catch {
        /* skip */
      }
    }

    if (weak >= 3) {
      const did = await appendPacingHint(ch.organizationId);
      if (did) updated += 1;
    }
  }

  return { orgs: orgs.size, updated };
}

export function registerYoutubeAnalyticsWorker() {
  void analyticsQueue.add(
    "analytics-pass",
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: "youtube-analytics-repeat",
      removeOnComplete: true,
    },
  );

  return registerWorker(ANALYTICS_QUEUE, async () => {
    await runAnalyticsPass();
  });
}
