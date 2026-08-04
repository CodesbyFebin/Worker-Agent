import { randomUUID } from "crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "./db";
import { agentTasks, contentCampaigns } from "../../drizzle/schema";
import { generateDailySubtopics } from "../services/campaign/contentCalendar";
import { dispatchTask } from "../agents";
import { publishEvent } from "./events";
import { enqueue, registerWorker, campaignDayQueue, scheduledPublishQueue, QUEUE_NAMES } from "./queue";
import type { AgentRole } from "../../shared/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Stage =
  | "researcher"
  | "writer"
  | "video_generator"
  | "voiceover"
  | "video_editor"
  | "caption_hashtag"
  | "seo"
  | "reviewer"
  | "finalize";

const STAGE_ORDER: Stage[] = [
  "researcher",
  "writer",
  "video_generator",
  "voiceover",
  "video_editor",
  "caption_hashtag",
  "seo",
  "reviewer",
  "finalize",
];

interface DayState {
  scriptText?: string;
  researchSummary?: string;
  researchClaims?: string[];
  videoPath?: string;
  audioPath?: string;
  finalVideoPath?: string;
  captionHashtag?: { caption: string; hashtags: string[] };
  seo?: { titles: string[]; description: string; tags: string[]; thumbnailPrompt: string };
}

interface CampaignDayJobData {
  campaignId: string;
  dayIndex: number;
  subtopic: string;
  publishAt: string; // ISO — kept as a string since job data is JSON-serialized into Redis
  dayRootTaskId?: string;
  stage: Stage;
  state: DayState;
}

async function insertAndRunTask(params: {
  campaignId: string;
  organizationId: string;
  dayIndex: number;
  dayRootTaskId: string;
  order: number;
  agentRole: AgentRole;
  title: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown> | null> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(agentTasks).values({
    id,
    organizationId: params.organizationId,
    parentTaskId: params.dayRootTaskId,
    campaignId: params.campaignId,
    dayIndex: params.dayIndex,
    agentRole: params.agentRole,
    title: params.title,
    order: params.order,
    payload: JSON.stringify(params.payload),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  await dispatchTask(id, params.agentRole);

  const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);
  return row?.result ? JSON.parse(row.result) : null;
}

async function markDayFailed(dayRootTaskId: string, reason: string): Promise<void> {
  await db.update(agentTasks).set({ status: "failed", errorMessage: reason }).where(eq(agentTasks.id, dayRootTaskId));
  await publishEvent({ taskId: dayRootTaskId, eventType: "error", message: reason });
}

/**
 * With each day running as its own independent chain of queue jobs, no
 * single function spans "all days" the way the old in-process for-loop
 * did — so campaign completion has to be checked explicitly after each
 * day reaches a terminal state (awaiting_approval counts as terminal here:
 * the *automated* pipeline is done, even though a human still has to approve).
 */
async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const dayRoots = await db
    .select()
    .from(agentTasks)
    .where(and(eq(agentTasks.campaignId, campaignId), isNull(agentTasks.parentTaskId)));

  const allTerminal = dayRoots.every((d) =>
    ["awaiting_approval", "completed", "failed", "blocked"].includes(d.status),
  );
  if (allTerminal && dayRoots.length > 0) {
    await db.update(contentCampaigns).set({ status: "completed" }).where(eq(contentCampaigns.id, campaignId));
  }
}

/**
 * Kicks off a full campaign: one LLM call plans N daily subtopics, then one
 * durable job per day is enqueued (all at once — the campaign-day worker's
 * concurrency=1 means only one pipeline *stage* runs at a time platform-wide,
 * regardless of which day it belongs to, which is what actually protects
 * the free image/TTS endpoints from being hammered — not blocking day 2
 * from starting until day 1 fully finishes, which the old in-process
 * version did unnecessarily).
 */
export async function startCampaign(params: {
  userId: string;
  organizationId: string;
  topic: string;
  totalDays: number;
  startDate: Date;
}): Promise<{ campaignId: string }> {
  const { userId, organizationId, topic, totalDays, startDate } = params;
  const campaignId = randomUUID();

  await db.insert(contentCampaigns).values({
    id: campaignId,
    organizationId,
    userId,
    topic,
    totalDays,
    startDate,
    status: "active",
    createdAt: new Date(),
  });

  const subtopics = await generateDailySubtopics({ topic, totalDays });

  for (const [i, subtopic] of subtopics.entries()) {
    const publishAt = new Date(startDate.getTime() + i * MS_PER_DAY);
    await enqueue(campaignDayQueue, "run-stage", {
      campaignId,
      dayIndex: i + 1,
      subtopic,
      publishAt: publishAt.toISOString(),
      stage: "researcher",
      state: {},
    } satisfies CampaignDayJobData);
  }

  return { campaignId };
}

/** Advances the job to the next stage, carrying forward the accumulated state — this is what makes a day's whole pipeline durable, not just one stage. */
async function advance(data: CampaignDayJobData, nextState: DayState): Promise<void> {
  const currentIndex = STAGE_ORDER.indexOf(data.stage);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  await enqueue(campaignDayQueue, "run-stage", {
    ...data,
    stage: nextStage,
    state: { ...data.state, ...nextState },
  } satisfies CampaignDayJobData);
}

export function registerCampaignDayWorker() {
  return registerWorker<CampaignDayJobData>(
    QUEUE_NAMES.CAMPAIGN_DAY,
    async (data) => {
      const [campaign] = await db
        .select()
        .from(contentCampaigns)
        .where(eq(contentCampaigns.id, data.campaignId))
        .limit(1);

      // Real pause: do not advance stages while paused — re-queue with delay.
      // In-flight dispatchTask calls are not cancelled (known limit).
      if (campaign?.status === "paused") {
        await enqueue(campaignDayQueue, "run-stage", data, { delayMs: 30_000 });
        return;
      }

      let dayRootTaskId = data.dayRootTaskId;

      if (!dayRootTaskId) {
        dayRootTaskId = randomUUID();
        const now = new Date();
        await db.insert(agentTasks).values({
          id: dayRootTaskId,
          organizationId: campaign?.organizationId ?? null,
          parentTaskId: null,
          campaignId: data.campaignId,
          dayIndex: data.dayIndex,
          agentRole: "planner",
          title: `Day ${data.dayIndex}: ${data.subtopic}`,
          order: data.dayIndex,
          payload: JSON.stringify({ subtopic: data.subtopic }),
          status: "running",
          createdAt: now,
          updatedAt: now,
        });
      }

      const orgId = campaign?.organizationId;
      if (!orgId) throw new Error(`Campaign ${data.campaignId} missing organizationId`);

      const base = {
        campaignId: data.campaignId,
        organizationId: orgId,
        dayIndex: data.dayIndex,
        dayRootTaskId,
      };

      switch (data.stage) {
        case "researcher": {
          const result = await insertAndRunTask({
            ...base,
            order: 0,
            agentRole: "researcher",
            title: "Research",
            payload: { instructions: data.subtopic },
          });
          await advance(
            { ...data, dayRootTaskId },
            {
              researchSummary: result?.summary as string | undefined,
              researchClaims: result?.claimsNeedingVerification as string[] | undefined,
            },
          );
          return;
        }

        case "writer": {
          const result = await insertAndRunTask({
            ...base,
            order: 1,
            agentRole: "writer",
            title: "Write script",
            payload: {
              instructions: `Subtopic: ${data.subtopic}\nResearch notes: ${data.state.researchSummary ?? ""}\nFlagged claims needing care: ${data.state.researchClaims?.join("; ") ?? "none"}`,
            },
          });
          const scriptText = result?.draft as string | undefined;
          if (!scriptText) throw new Error("Writer produced no script");
          await advance({ ...data, dayRootTaskId }, { scriptText });
          return;
        }

        case "video_generator": {
          const result = await insertAndRunTask({
            ...base,
            order: 2,
            agentRole: "video_generator",
            title: "Generate video",
            payload: { instructions: data.state.scriptText ?? "" },
          });
          await advance({ ...data, dayRootTaskId }, { videoPath: result?.videoPath as string | undefined });
          return;
        }

        case "voiceover": {
          const result = await insertAndRunTask({
            ...base,
            order: 3,
            agentRole: "voiceover",
            title: "Generate voiceover",
            payload: { instructions: data.state.scriptText ?? "" },
          });
          await advance({ ...data, dayRootTaskId }, { audioPath: result?.audioPath as string | undefined });
          return;
        }

        case "video_editor": {
          const result = await insertAndRunTask({
            ...base,
            order: 4,
            agentRole: "video_editor",
            title: "Edit video (mux audio + burn captions)",
            payload: {
              instructions: data.state.scriptText ?? "",
              videoPath: data.state.videoPath,
              audioPath: data.state.audioPath,
              scriptText: data.state.scriptText,
            },
          });
          const finalVideoPath = result?.finalVideoPath as string | undefined;
          if (!finalVideoPath) throw new Error("Video editor produced no final video");
          await advance({ ...data, dayRootTaskId }, { finalVideoPath });
          return;
        }

        case "caption_hashtag": {
          const result = await insertAndRunTask({
            ...base,
            order: 5,
            agentRole: "caption_hashtag",
            title: "Caption + hashtags",
            payload: { instructions: data.state.scriptText ?? "" },
          });
          await advance(
            { ...data, dayRootTaskId },
            { captionHashtag: result as { caption: string; hashtags: string[] } | undefined },
          );
          return;
        }

        case "seo": {
          const result = await insertAndRunTask({
            ...base,
            order: 6,
            agentRole: "seo",
            title: "SEO metadata",
            payload: { instructions: data.state.scriptText ?? "" },
          });
          await advance(
            { ...data, dayRootTaskId },
            { seo: result as DayState["seo"] },
          );
          return;
        }

        case "reviewer": {
          const result = await insertAndRunTask({
            ...base,
            order: 7,
            agentRole: "reviewer",
            title: "Final review",
            payload: {
              instructions: `Script:\n${data.state.scriptText}\n\nDescription:\n${data.state.seo?.description ?? ""}\n\nCaption:\n${data.state.captionHashtag?.caption ?? ""}`,
            },
          });
          if (result?.approved === false) {
            await markDayFailed(dayRootTaskId, `Reviewer rejected: ${(result.issues as string[] | undefined)?.join("; ")}`);
            await maybeCompleteCampaign(data.campaignId);
            return; // stop the chain — do not advance to finalize/publish
          }
          await advance({ ...data, dayRootTaskId }, {});
          return;
        }

        case "finalize": {
          const hashtags = data.state.captionHashtag?.hashtags ?? [];
          const id = randomUUID();
          const now = new Date();
          await db.insert(agentTasks).values({
            id,
            organizationId: orgId,
            parentTaskId: dayRootTaskId,
            campaignId: data.campaignId,
            dayIndex: data.dayIndex,
            agentRole: "publisher",
            title: "Publish (awaiting human approval)",
            order: 8,
            payload: JSON.stringify({
              instructions: "",
              platforms: ["youtube"],
              content: {
                title: data.state.seo?.titles?.[0] ?? data.subtopic,
                description: `${data.state.seo?.description ?? ""}\n\n${hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
                tags: data.state.seo?.tags ?? [],
                mediaUrl: data.state.finalVideoPath,
              },
            }),
            status: "awaiting_approval",
            scheduledAt: new Date(data.publishAt),
            createdAt: now,
            updatedAt: now,
          });

          await db.update(agentTasks).set({ status: "awaiting_approval" }).where(eq(agentTasks.id, dayRootTaskId));
          await publishEvent({ taskId: dayRootTaskId, eventType: "status_changed", message: "awaiting_approval" });
          await maybeCompleteCampaign(data.campaignId);
          return;
        }
      }
    },
    // Runs only once BullMQ's own attempts for this specific stage are exhausted.
    async (data, error) => {
      if (data.dayRootTaskId) {
        await markDayFailed(data.dayRootTaskId, `Stage "${data.stage}" failed after retries: ${error.message}`);
        await maybeCompleteCampaign(data.campaignId);
      }
    },
  );
}

/**
 * Enqueues a delayed publish job — called by campaign.approveDay once a
 * human approves. Replaces the old 60s setInterval poller: BullMQ's own
 * delayed-job mechanism (backed by Redis) fires this at the right time
 * even across a server restart.
 */
export async function schedulePublish(taskId: string, scheduledAt: Date): Promise<void> {
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
  await enqueue(scheduledPublishQueue, "publish", { taskId }, { delayMs });
}

export function registerScheduledPublishWorker() {
  return registerWorker<{ taskId: string }>(QUEUE_NAMES.SCHEDULED_PUBLISH, async ({ taskId }) => {
    await dispatchTask(taskId, "publisher");
  });
}
