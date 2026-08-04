import { randomUUID } from "crypto";
import { completeJSON } from "../_core/llm";
import { db } from "../_core/db";
import { agentTasks } from "../../drizzle/schema";
import type { AgentRole } from "../../shared/types";

interface PlannedSubtask {
  agentRole: AgentRole;
  title: string;
  instructions: string;
}

const SYSTEM_PROMPT = `You are the planner for WorkerAgent.Cloud.
Break the goal into 2-4 short subtasks. Each needs:
- agentRole: one of researcher, writer, reviewer, coder, qa, publisher
- title: max 8 words
- instructions: max 25 words, concrete

Prefer researcher → writer → reviewer for content goals.
Prefer researcher → coder → qa for code goals.
Keep JSON tiny — free models truncate long plans.`;

function looksLikeContentGoal(goal: string): boolean {
  return /\b(script|short|youtube|tiktok|reel|blog|post|caption|copy|article|content|ukg|video)\b/i.test(
    goal,
  );
}

function looksLikeCodeGoal(goal: string): boolean {
  return /\b(code|fix|bug|implement|refactor|api|script\.py|typescript|react)\b/i.test(goal);
}

/** Deterministic plan when free models return truncated/invalid JSON. */
function fallbackPlan(goal: string): PlannedSubtask[] {
  const g = goal.slice(0, 120);
  if (looksLikeCodeGoal(goal) && !looksLikeContentGoal(goal)) {
    return [
      {
        agentRole: "researcher",
        title: "Scope the change",
        instructions: `Identify files and constraints for: ${g}`,
      },
      {
        agentRole: "coder",
        title: "Implement the change",
        instructions: `Apply minimal code changes for: ${g}`,
      },
      {
        agentRole: "qa",
        title: "Verify the change",
        instructions: `Check behavior and edge cases for: ${g}`,
      },
    ];
  }
  return [
    {
      agentRole: "researcher",
      title: "Gather context",
      instructions: `Research key facts and audience angle for: ${g}`,
    },
    {
      agentRole: "writer",
      title: "Draft the deliverable",
      instructions: `Write the requested output for: ${g}`,
    },
    {
      agentRole: "reviewer",
      title: "Polish and verify",
      instructions: `Review draft for accuracy, tone, and completeness for: ${g}`,
    },
  ];
}

/**
 * Decomposes a goal into child tasks under a root planner task.
 */
export async function planGoal(params: {
  goal: string;
  scriptId?: string;
  organizationId: string;
}): Promise<{
  rootTaskId: string;
  subtaskIds: string[];
}> {
  const { goal, scriptId, organizationId } = params;

  let subtasks: PlannedSubtask[] = [];
  try {
    const result = await completeJSON<{ subtasks: PlannedSubtask[] }>({
      system: SYSTEM_PROMPT,
      prompt: `Goal: ${goal}\n\nReturn ONLY: {"subtasks":[{"agentRole":"researcher","title":"...","instructions":"..."}]}`,
      maxTokens: 550,
    });
    subtasks = result.subtasks ?? [];
  } catch (err) {
    console.warn("[planner] JSON plan failed, using fallback:", (err as Error).message.slice(0, 200));
    subtasks = fallbackPlan(goal);
  }

  if (!subtasks?.length) {
    subtasks = fallbackPlan(goal);
  }

  const allowed: AgentRole[] = ["researcher", "writer", "reviewer", "coder", "qa", "publisher"];
  const cleaned = subtasks
    .filter((s) => s?.agentRole && s?.title && s?.instructions)
    .map((s) => ({
      agentRole: (allowed.includes(s.agentRole as AgentRole) ? s.agentRole : "writer") as AgentRole,
      title: String(s.title).slice(0, 200),
      instructions: String(s.instructions).slice(0, 800),
    }));

  if (!cleaned.length) {
    throw new Error("Planner produced no usable subtasks");
  }

  const rootTaskId = randomUUID();
  const now = new Date();

  await db.insert(agentTasks).values({
    id: rootTaskId,
    organizationId,
    parentTaskId: null,
    scriptId: scriptId ?? null,
    agentRole: "planner",
    title: `Plan: ${goal}`.slice(0, 255),
    payload: JSON.stringify({ goal }),
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });

  const subtaskIds: string[] = [];
  for (const [index, subtask] of cleaned.entries()) {
    const id = randomUUID();
    subtaskIds.push(id);
    await db.insert(agentTasks).values({
      id,
      organizationId,
      parentTaskId: rootTaskId,
      scriptId: scriptId ?? null,
      agentRole: subtask.agentRole,
      title: subtask.title,
      order: index,
      payload: JSON.stringify({ instructions: subtask.instructions }),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  return { rootTaskId, subtaskIds };
}
