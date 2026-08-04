import { eq } from "drizzle-orm";
import { db } from "./db";
import { agentTasks } from "../../drizzle/schema";
import { planGoal } from "../agents/planner.agent";
import { dispatchTask } from "../agents";
import { publishEvent } from "./events";
import { enqueue, registerWorker, godMachineChainQueue, QUEUE_NAMES } from "./queue";
import type { AgentRole } from "../../shared/types";

interface ChainJobData {
  rootTaskId: string;
  subtaskIds: string[];
  index: number;
}

/**
 * Plans the goal, then hands the subtask chain off to a durable BullMQ
 * queue instead of running it in an in-process loop. Each job in the chain
 * runs exactly one subtask; on success, its processor enqueues the NEXT
 * job before returning (see registerGodMachineWorker below) — that's what
 * makes the whole chain durable, not just each individual step: if the
 * server restarts between jobs, the next job is already sitting in Redis,
 * waiting for any worker (this process or a fresh one after restart) to
 * pick it up. Compare to the old `void runChain(...)` in-process loop,
 * which lost all progress on a restart.
 */
export async function orchestrateGoal(params: {
  goal: string;
  scriptId?: string;
  userId?: string;
  organizationId: string;
}): Promise<{
  rootTaskId: string;
  scriptId?: string;
  pipelineId?: string;
}> {
  let scriptId = params.scriptId;
  let pipelineId: string | undefined;

  const pipelineMod = await import("../services/pipeline/contentOpsPipeline");
  if (params.userId && pipelineMod.looksLikeScriptGoal(params.goal) && !scriptId) {
    const started = await pipelineMod.startContentPipeline({
      userId: params.userId,
      organizationId: params.organizationId,
      title: `Script: ${params.goal}`.slice(0, 255),
      goal: params.goal,
    });
    scriptId = started.scriptId;
    pipelineId = started.pipelineId;
  }

  const { rootTaskId, subtaskIds } = await planGoal({
    goal: params.goal,
    scriptId,
    organizationId: params.organizationId,
  });
  if (pipelineId) {
    await pipelineMod.linkPipelineRootTask(pipelineId, rootTaskId);
  }
  await enqueue(godMachineChainQueue, "run-subtask", { rootTaskId, subtaskIds, index: 0 });
  return { rootTaskId, scriptId, pipelineId };
}

async function blockRemaining(rootTaskId: string, fromIndex: number, subtaskIds: string[]): Promise<void> {
  for (const taskId of subtaskIds.slice(fromIndex)) {
    await db.update(agentTasks).set({ status: "blocked" }).where(eq(agentTasks.id, taskId));
  }
}

/**
 * Registers the worker that actually drives the chain forward. Call this
 * once from the worker process (`server/_core/worker.ts`), not from the API.
 */
export function registerGodMachineWorker() {
  return registerWorker<ChainJobData>(
    QUEUE_NAMES.GOD_MACHINE_CHAIN,
    async ({ rootTaskId, subtaskIds, index }) => {
      const taskId = subtaskIds[index];
      const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1);
      if (!task) throw new Error(`Task ${taskId} not found`);

      // Throwing here lets BullMQ's own retry/backoff (configured in
      // queue.ts's DEFAULT_JOB_OPTS) handle this step — we don't duplicate
      // retry logic here the way the old in-process loop had to.
      await dispatchTask(taskId, task.agentRole as AgentRole);

      const nextIndex = index + 1;
      if (nextIndex < subtaskIds.length) {
        await enqueue(godMachineChainQueue, "run-subtask", { rootTaskId, subtaskIds, index: nextIndex });
      } else {
        await publishEvent({ taskId: rootTaskId, eventType: "status_changed", message: "chain completed" });
      }
    },
    // Runs only once BullMQ's own attempts for this specific step are exhausted.
    async ({ rootTaskId, subtaskIds, index }, error) => {
      await blockRemaining(rootTaskId, index + 1, subtaskIds);
      await publishEvent({
        taskId: rootTaskId,
        eventType: "error",
        message: `Chain stopped at subtask ${index}: ${error.message}`,
      });
    },
  );
}
