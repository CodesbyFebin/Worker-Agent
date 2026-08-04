import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

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

export function enqueue<T>(queue: Queue<T>, name: string, data: T, opts?: { delayMs?: number }) {
  return queue.add(name, data, { ...DEFAULT_JOB_OPTS, delay: opts?.delayMs ?? 0 });
}

/**
 * Registers a worker + a failure listener that runs `onExhausted` only once
 * BullMQ's own retry attempts are used up — that's the real "give up and
 * tell someone" point, as opposed to every individual attempt failing.
 */
export function registerWorker<T>(
  queueName: string,
  processor: (data: T) => Promise<void>,
  onExhausted?: (data: T, error: Error) => Promise<void>,
) {
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      await processor(job.data);
    },
    { connection, concurrency: 5 },
  );

  worker.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[queue:${queueName}] worker error:`, err.message);
  });

  if (onExhausted) {
    const events = new QueueEvents(queueName, { connection });
    events.on("failed", async ({ jobId, failedReason }) => {
      const queueMap: Record<string, Queue> = {
        [QUEUE_NAMES.GOD_MACHINE_CHAIN]: godMachineChainQueue,
        [QUEUE_NAMES.CAMPAIGN_DAY]: campaignDayQueue,
        [QUEUE_NAMES.SCHEDULED_PUBLISH]: scheduledPublishQueue,
      };
      const job = await queueMap[queueName]?.getJob(jobId);
      if (!job) return;
      // job.attemptsMade === job.opts.attempts means every retry is used up.
      if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
        await onExhausted(job.data as T, new Error(failedReason));
      }
    });
  }

  return worker;
}

export async function shutdownQueues(): Promise<void> {
  await Promise.all([
    godMachineChainQueue.close(),
    campaignDayQueue.close(),
    scheduledPublishQueue.close(),
  ]);
  await (connection as IORedis).quit();
}
