import { registerWorker, QUEUE_NAMES } from "./queue";
import { processWorkflowStep, type WorkflowStepJobData } from "../services/workflow/runtime";

/** One BullMQ job = one workflow step. Never runs an entire graph in-process. */
export function registerWorkflowStepWorker() {
  return registerWorker<WorkflowStepJobData>(QUEUE_NAMES.WORKFLOW_STEP, async (data: WorkflowStepJobData) => {
    await processWorkflowStep(data);
  });
}
