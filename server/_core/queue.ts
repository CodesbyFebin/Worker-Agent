/**
 * Updates registerWorker to always persist exhausted jobs to the durable DLQ.
 */
import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { redactString } from "./redact";
import { queueLogger } from "./logger";
import { metrics } from "./metrics";

/**
 * BullMQ requires this exact option on a shared ioredis connection used for
 * blocking commands — without it, workers throw at runtime.
 */
export const connection: ConnectionOptions = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  GOD_MACHINE_CHAIN: "god-machine-chain",
  CAMPAIGN_DAY: "campaign-day",
  SCHEDULED_PUBLISH: "scheduled-publish",
  WORKFLOW_STEP: "workflow-step",
  PYTHON_TRANSCRIPTION: "python-transcription",
  PYTHON_AUDIO_ANALYSIS: "python-audio-analysis",
  PYTHON_THUMBNAIL_SCORE: "python-thumbnail-score",
} as const;

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep 7 days for inspection, then GC
  removeOnFail: { age: 60 * 60 * 24 * 30 },
};

export const godMachineChainQueue = new Queue(QUEUE_NAMES.GOD_MACHINE_CHAIN, { connection });
export const campaignDayQueue = new Queue(QUEUE_NAMES.CAMPAIGN_DAY, { connection });
export const scheduledPublishQueue = new Queue(QUEUE_NAMES.SCHEDULED_PUBLISH, { connection });
export const workflowStepQueue = new Queue(QUEUE_NAMES.WORKFLOW_STEP, { connection });
export const pythonTranscriptionQueue = new Queue(QUEUE_NAMES.PYTHON_TRANSCRIPTION, { connection });
export const pythonAudioAnalysisQueue = new Queue(QUEUE_NAMES.PYTHON_AUDIO_ANALYSIS, { connection });
export const pythonThumbnailScoreQueue = new Queue(QUEUE_NAMES.PYTHON_THUMBNAIL_SCORE, { connection });

export function enqueue<T>(queue: Queue<T>, name: string, data: T, opts?: { delayMs?: number }) {
  // BullMQ's Queue<Data, Result, Name> generics make free-form job names awkward.
  // Call sites pass operational names ("run-subtask", "run-stage"); cast at the boundary.
  return (queue as Queue).add(name, data as object, {
    ...DEFAULT_JOB_OPTS,
    delay: opts?.delayMs ?? 0,
  });
}

/**
 * Registers a worker + a failure listener that runs `onExhausted` only once
 * BullMQ's own retry attempts are used up — that's the real "give up and
 * tell someone" point, as opposed to every individual attempt failing.
 * Exhausted jobs are always written to `dead_letter_jobs` (redacted payload).
 */
export function registerWorker<T>(
  queueName: string,
  processor: (data: T) => Promise<void>,
  onExhausted?: (data: T, error: Error) => Promise<void>,
) {
  const qLogger = queueLogger({ queue: queueName });
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      qLogger.debug({ jobId: job.id, jobName: job.name }, "job_started");
      const start = Date.now();
      await processor(job.data);
      const durationMs = Date.now() - start;
      qLogger.debug({ jobId: job.id, durationMs }, "job_completed");
    },
    { connection, concurrency: 5 },
  );

  worker.on("error", (err) => {
    qLogger.error({ error: redactString(err.message) }, "worker_error");
  });

  worker.on("completed", (job) => {
    qLogger.debug({ jobId: job.id }, "job_completed_event");
  });

  worker.on("failed", (job, err) => {
    qLogger.warn({ jobId: job?.id, error: redactString(err?.message) }, "job_failed_event");
  });

  const events = new QueueEvents(queueName, { connection });
  events.on("failed", async ({ jobId, failedReason }) => {
    const queueMap: Record<string, Queue> = {
      [QUEUE_NAMES.GOD_MACHINE_CHAIN]: godMachineChainQueue,
      [QUEUE_NAMES.CAMPAIGN_DAY]: campaignDayQueue,
      [QUEUE_NAMES.SCHEDULED_PUBLISH]: scheduledPublishQueue,
      [QUEUE_NAMES.WORKFLOW_STEP]: workflowStepQueue,
      [QUEUE_NAMES.PYTHON_TRANSCRIPTION]: pythonTranscriptionQueue,
      [QUEUE_NAMES.PYTHON_AUDIO_ANALYSIS]: pythonAudioAnalysisQueue,
      [QUEUE_NAMES.PYTHON_THUMBNAIL_SCORE]: pythonThumbnailScoreQueue,
    };
    const queue = queueMap[queueName];
    if (!queue) return;
    const job = await queue.getJob(jobId);
    if (!job) return;
    // job.attemptsMade === job.opts.attempts means every retry is used up.
    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
      const err = new Error(failedReason);
      metrics.dlqEnqueuedTotal.inc({ queue: queueName, job_name: typeof job.name === "string" ? job.name : "unknown" });
      try {
        const { recordDeadLetter } = await import("../services/ops/deadLetter");
        await recordDeadLetter({
          queueName,
          jobName: typeof job.name === "string" ? job.name : null,
          bullmqJobId: jobId,
          payload: job.data,
          errorMessage: failedReason,
          attemptsMade: job.attemptsMade ?? 0,
        });
      } catch (dlqErr) {
        qLogger.error(
          { error: redactString(dlqErr instanceof Error ? dlqErr.message : String(dlqErr)) },
          "dlq_persist_failed",
        );
      }
      if (onExhausted) {
        await onExhausted(job.data as T, err);
      }
    }
  });

  return worker;
}

/** Lightweight connectivity probe for readiness checks. */
export async function pingRedis(): Promise<void> {
  const pong = await (connection as IORedis).ping();
  if (pong !== "PONG") {
    throw new Error(`Unexpected Redis PING response: ${String(pong)}`);
  }
}

export async function shutdownQueues(): Promise<void> {
  await Promise.all([
    godMachineChainQueue.close(),
    campaignDayQueue.close(),
    scheduledPublishQueue.close(),
    workflowStepQueue.close(),
    pythonTranscriptionQueue.close(),
    pythonAudioAnalysisQueue.close(),
    pythonThumbnailScoreQueue.close(),
  ]);
  await (connection as IORedis).quit();
}
