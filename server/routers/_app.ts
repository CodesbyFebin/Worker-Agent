import { router } from "../_core/trpc";
import { scriptRouter } from "./script.router";
import { ledgerRouter } from "./ledger.router";
import { godMachineRouter } from "./godMachine.router";
import { campaignRouter } from "./campaign.router";
import { ideRouter } from "./ide.router";
import { connectorsRouter } from "./connectors.router";
import { settingsRouter } from "./settings.router";
import { pipelineRouter } from "./pipeline.router";

export const appRouter = router({
  script: scriptRouter,
  ledger: ledgerRouter,
  godMachine: godMachineRouter,
  campaign: campaignRouter,
  ide: ideRouter,
  connectors: connectorsRouter,
  settings: settingsRouter,
  pipeline: pipelineRouter,
});

export type AppRouter = typeof appRouter;
