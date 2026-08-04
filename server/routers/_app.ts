import { router } from "../_core/trpc";
import { scriptRouter } from "./script.router";
import { ledgerRouter } from "./ledger.router";
import { godMachineRouter } from "./godMachine.router";
import { campaignRouter } from "./campaign.router";
import { ideRouter } from "./ide.router";
import { connectorsRouter } from "./connectors.router";
import { settingsRouter } from "./settings.router";
import { pipelineRouter } from "./pipeline.router";
import { authRouter } from "./auth.router";
import { workflowRouter } from "./workflow.router";
import { agentsRouter } from "./agents.router";
import { toolsRouter } from "./tools.router";
import { governanceRouter } from "./governance.router";
import { artifactsRouter } from "./artifacts.router";
import { opsRouter } from "./ops.router";

export const appRouter = router({
  auth: authRouter,
  script: scriptRouter,
  ledger: ledgerRouter,
  godMachine: godMachineRouter,
  campaign: campaignRouter,
  ide: ideRouter,
  connectors: connectorsRouter,
  settings: settingsRouter,
  pipeline: pipelineRouter,
  workflow: workflowRouter,
  agents: agentsRouter,
  tools: toolsRouter,
  governance: governanceRouter,
  artifacts: artifactsRouter,
  ops: opsRouter,
});

export type AppRouter = typeof appRouter;
