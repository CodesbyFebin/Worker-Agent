import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers/_app";
import { createContext } from "./context";
import { env } from "./env";
import { registerGodMachineWorker } from "./god-machine";
import { registerCampaignDayWorker, registerScheduledPublishWorker } from "./youtube-automode";
import { shutdownQueues } from "./queue";
import { subscribeToEvents } from "./events";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      // eslint-disable-next-line no-console
      console.error(`[tRPC] ${path ?? "<unknown>"}:`, error.message);
    },
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Real SSE stream of agent lifecycle events (persisted + in-process).
 * Known limit: no auth on this route yet — same stand-in as x-user-id header
 * auth; lock down when real sessions land.
 */
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  const unsub = subscribeToEvents((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Worker Agent.Cloud API listening on :${env.PORT}`);
});

// Workers run in this same process for simplicity. A real production
// deployment should run these in a separate worker process/container so a
// deploy of the API doesn't also restart in-flight job processing — see
// README's "Known limits" section.
const godMachineWorker = registerGodMachineWorker();
const campaignDayWorker = registerCampaignDayWorker();
const scheduledPublishWorker = registerScheduledPublishWorker();

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[shutdown] received ${signal}, closing workers and queues...`);
  await Promise.all([godMachineWorker.close(), campaignDayWorker.close(), scheduledPublishWorker.close()]);
  await shutdownQueues();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
