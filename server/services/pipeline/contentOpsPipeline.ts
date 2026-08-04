import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { contentOpsPipelines, scriptSections, scripts } from "../../../drizzle/schema";
import { publishEvent } from "../../_core/events";

export const PIPELINE_STAGES = [
  "god_machine",
  "script_studio",
  "evidence",
  "research_to_post",
  "workspace",
  "youtube_autopilot",
  "social",
  "approvals",
  "publishing",
  "done",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_WORKSPACE: Record<Exclude<PipelineStage, "done">, string> = {
  god_machine: "god-machine",
  script_studio: "script-studio",
  evidence: "evidence",
  research_to_post: "research-to-post",
  workspace: "workspace",
  youtube_autopilot: "youtube-automode",
  social: "social-manager",
  approvals: "approvals",
  publishing: "publishing",
};

export const STAGE_LABEL: Record<PipelineStage, string> = {
  god_machine: "God Machine",
  script_studio: "Script Studio",
  evidence: "Evidence",
  research_to_post: "Research-to-Post",
  workspace: "Workspace",
  youtube_autopilot: "YouTube Autopilot",
  social: "Social Manager",
  approvals: "Approvals",
  publishing: "Publishing",
  done: "Done",
};

export function looksLikeScriptGoal(goal: string): boolean {
  return /\b(script|short|youtube|reel|tiktok|caption|copy|hook|cta|video script|write.*(post|content))\b/i.test(
    goal,
  );
}

/** Split a free-form draft into hook / body / cta sections for Script Studio. */
export function draftToSections(draft: string): Array<{
  kind: "hook" | "body" | "cta";
  content: string;
}> {
  const parts = draft
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return [
      { kind: "hook", content: parts[0]! },
      { kind: "body", content: parts.slice(1, -1).join("\n\n") },
      { kind: "cta", content: parts[parts.length - 1]! },
    ];
  }
  if (parts.length === 2) {
    return [
      { kind: "hook", content: parts[0]! },
      { kind: "body", content: parts[1]! },
      { kind: "cta", content: "Follow for more." },
    ];
  }
  const text = draft.trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 3) {
    return [
      { kind: "hook", content: sentences[0]! },
      { kind: "body", content: sentences.slice(1, -1).join(" ") },
      { kind: "cta", content: sentences[sentences.length - 1]! },
    ];
  }
  return [
    { kind: "hook", content: text.slice(0, 160) || "Hook pending" },
    { kind: "body", content: text || "Body pending" },
    { kind: "cta", content: "Learn more — follow for the next episode." },
  ];
}

export async function createScriptWithSections(params: {
  userId: string;
  title: string;
  draft?: string;
  targetDurationSeconds?: number;
}): Promise<{ scriptId: string }> {
  const id = randomUUID();
  const now = new Date();
  const sectionDefs = params.draft
    ? draftToSections(params.draft)
    : [
        { kind: "hook" as const, content: "" },
        { kind: "body" as const, content: "" },
        { kind: "cta" as const, content: "" },
      ];
  const fullText = sectionDefs.map((s) => s.content).join("\n\n").trim();

  await db.insert(scripts).values({
    id,
    userId: params.userId,
    title: params.title.slice(0, 255),
    fullText,
    targetDurationSeconds: params.targetDurationSeconds ?? 60,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(scriptSections).values(
    sectionDefs.map((s, order) => ({
      id: randomUUID(),
      scriptId: id,
      kind: s.kind,
      order,
      content: s.content,
      wordCount: s.content.split(/\s+/).filter(Boolean).length,
      lastRegeneratedAt: null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return { scriptId: id };
}

export async function applyDraftToScript(scriptId: string, draft: string): Promise<void> {
  const now = new Date();
  const sectionDefs = draftToSections(draft);
  const fullText = sectionDefs.map((s) => s.content).join("\n\n").trim();

  await db.update(scripts).set({ fullText, updatedAt: now }).where(eq(scripts.id, scriptId));

  const existing = await db.select().from(scriptSections).where(eq(scriptSections.scriptId, scriptId));
  for (const row of existing) {
    const match = sectionDefs.find((s) => s.kind === row.kind);
    if (!match) continue;
    await db
      .update(scriptSections)
      .set({
        content: match.content,
        wordCount: match.content.split(/\s+/).filter(Boolean).length,
        updatedAt: now,
      })
      .where(eq(scriptSections.id, row.id));
  }
}

export async function startContentPipeline(params: {
  userId: string;
  title: string;
  goal: string;
  rootTaskId?: string;
  draft?: string;
}): Promise<{ pipelineId: string; scriptId: string }> {
  const { scriptId } = await createScriptWithSections({
    userId: params.userId,
    title: params.title,
    draft: params.draft,
  });

  const pipelineId = randomUUID();
  const now = new Date();
  await db.insert(contentOpsPipelines).values({
    id: pipelineId,
    userId: params.userId,
    scriptId,
    rootTaskId: params.rootTaskId ?? null,
    campaignId: null,
    title: params.title.slice(0, 255),
    stage: params.draft ? "script_studio" : "god_machine",
    createdAt: now,
    updatedAt: now,
  });

  return { pipelineId, scriptId };
}

export async function linkPipelineRootTask(pipelineId: string, rootTaskId: string): Promise<void> {
  await db
    .update(contentOpsPipelines)
    .set({ rootTaskId, updatedAt: new Date() })
    .where(eq(contentOpsPipelines.id, pipelineId));
}

/**
 * After God Machine writer finishes: push draft into Script Studio and move stage.
 */
export async function ingestWriterDraftForTask(params: {
  taskId: string;
  scriptId: string | null;
  draft: string;
  titleHint: string;
}): Promise<{ scriptId: string; pipelineId: string | null } | null> {
  const draft = params.draft.trim();
  if (!draft) return null;

  let scriptId = params.scriptId;
  let pipelineId: string | null = null;

  if (scriptId) {
    const [pipe] = await db
      .select()
      .from(contentOpsPipelines)
      .where(eq(contentOpsPipelines.scriptId, scriptId))
      .orderBy(desc(contentOpsPipelines.updatedAt))
      .limit(1);
    pipelineId = pipe?.id ?? null;

    await applyDraftToScript(scriptId, draft);
    if (pipe && (pipe.stage === "god_machine" || pipe.stage === "script_studio")) {
      await db
        .update(contentOpsPipelines)
        .set({ stage: "script_studio", updatedAt: new Date() })
        .where(eq(contentOpsPipelines.id, pipe.id));
    }
  } else {
    // Find pipeline by root task (parent of this writer task)
    const { agentTasks } = await import("../../../drizzle/schema");
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, params.taskId)).limit(1);
    if (!task?.parentTaskId) return null;

    const [pipe] = await db
      .select()
      .from(contentOpsPipelines)
      .where(eq(contentOpsPipelines.rootTaskId, task.parentTaskId))
      .limit(1);

    if (!pipe) return null;
    scriptId = pipe.scriptId;
    pipelineId = pipe.id;
    await applyDraftToScript(scriptId, draft);
    await db
      .update(contentOpsPipelines)
      .set({ stage: "script_studio", updatedAt: new Date() })
      .where(eq(contentOpsPipelines.id, pipe.id));
  }

  await publishEvent({
    taskId: params.taskId,
    eventType: "pipeline_handoff",
    message: `Draft landed in Script Studio (script ${scriptId.slice(0, 8)}…)`,
  });

  return { scriptId, pipelineId };
}

export function nextStage(current: PipelineStage): PipelineStage | null {
  const i = PIPELINE_STAGES.indexOf(current);
  if (i < 0 || i >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[i + 1]!;
}

export async function advancePipeline(params: {
  pipelineId: string;
  userId: string;
}): Promise<{ stage: PipelineStage; workspaceId: string | null; scriptId: string }> {
  const [pipe] = await db
    .select()
    .from(contentOpsPipelines)
    .where(and(eq(contentOpsPipelines.id, params.pipelineId), eq(contentOpsPipelines.userId, params.userId)))
    .limit(1);

  if (!pipe) throw new Error("Pipeline not found");

  const nxt = nextStage(pipe.stage as PipelineStage);
  if (!nxt) {
    return {
      stage: pipe.stage as PipelineStage,
      workspaceId: null,
      scriptId: pipe.scriptId,
    };
  }

  await db
    .update(contentOpsPipelines)
    .set({ stage: nxt, updatedAt: new Date() })
    .where(eq(contentOpsPipelines.id, pipe.id));

  const workspaceId = nxt === "done" ? null : STAGE_WORKSPACE[nxt];

  if (pipe.rootTaskId) {
    await publishEvent({
      taskId: pipe.rootTaskId,
      eventType: "pipeline_advance",
      message: `Advanced to ${STAGE_LABEL[nxt]}`,
    });
  }

  return { stage: nxt, workspaceId, scriptId: pipe.scriptId };
}
