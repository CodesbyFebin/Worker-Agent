/**
 * Worker process entry — BullMQ processors plus durable Mission Control outbox.
 * Long-running agent/campaign/publish/workflow jobs must not run inside the API process.
 */
import { registerGodMachineWorker } from "./god-machine";
import { registerCampaignDayWorker, registerScheduledPublishWorker } from "./youtube-automode";
import { registerWorkflowStepWorker } from "./workflow-worker";
import { registerYoutubeAnalyticsWorker } from "../services/youtube/analyticsWorker";
import {
  registerPythonTranscriptionWorker,
  registerPythonAudioAnalysisWorker,
  registerPythonThumbnailScoreWorker,
} from "../services/python/workers";
import { startOutboxWorker } from "../services/mission-control/outbox";
import { shutdownQueues } from "./queue";
import { logger } from "./logger";

console.log("Worker Agent.Cloud worker process starting…");
process.env.WA_PROCESS_ROLE = "worker";

const godMachineWorker = registerGodMachineWorker();
const campaignDayWorker = registerCampaignDayWorker();
const scheduledPublishWorker = registerScheduledPublishWorker();
const workflowStepWorker = registerWorkflowStepWorker();
const youtubeAnalyticsWorker = registerYoutubeAnalyticsWorker();
const pythonTranscriptionWorker = registerPythonTranscriptionWorker();
const pythonAudioAnalysisWorker = registerPythonAudioAnalysisWorker();
const pythonThumbnailScoreWorker = registerPythonThumbnailScoreWorker();
const missionControlOutboxWorker = startOutboxWorker();

logger.info(
  {
    workers: [
      "god-machine-chain",
      "campaign-day",
      "scheduled-publish",
      "workflow-step",
      "youtube-analytics",
      "python-transcription",
      "python-audio-analysis",
      "python-thumbnail-score",
      "mission-control-outbox",
    ],
  },
  "workers_registered",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "worker_shutdown_started");
  await missionControlOutboxWorker.stop();
  await Promise.all([
    godMachineWorker.close(),
    campaignDayWorker.close(),
    scheduledPublishWorker.close(),
    workflowStepWorker.close(),
    youtubeAnalyticsWorker.close(),
    pythonTranscriptionWorker.close(),
    pythonAudioAnalysisWorker.close(),
    pythonThumbnailScoreWorker.close(),
  ]);
  await shutdownQueues();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
