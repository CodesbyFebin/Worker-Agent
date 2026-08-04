import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import { AppShell, type WorkspaceId } from "./components/AppShell";
import { ScriptStudioWorkspace } from "./features/script-studio/ScriptStudioWorkspace";
import { ClaimLedgerWorkspace } from "./features/claim-ledger/ClaimLedgerWorkspace";
import { GodMachineWorkspace } from "./features/god-machine/GodMachineWorkspace";
import { IdeWorkspace } from "./features/idea-ide/IdeWorkspace";
import { ContentOpsStudio } from "./features/youtube-automode/ContentOpsStudio";
import { VideoAutopilotWorkspace } from "./features/youtube-automode/VideoAutopilotWorkspace";
import { OverviewWorkspace } from "./features/overview/OverviewWorkspace";
import { LearnWorkspace } from "./features/learn/LearnWorkspace";
import { PluginsWorkspace } from "./features/plugins/PluginsWorkspace";
import { AutomationsPipelineWorkspace } from "./features/automations/AutomationsPipelineWorkspace";
import { TemplateLibraryWorkspace } from "./features/templates/TemplateLibraryWorkspace";
import { SocialManagerWorkspace } from "./features/social/SocialManagerWorkspace";
import { ActivityWorkspace, InboxWorkspace } from "./features/activity/ActivityWorkspace";
import {
  CalendarWorkspace,
  SettingsWorkspace,
  GovernanceWorkspace,
} from "./features/ops/OpsWorkspaces";
import { ContentOpsWorkspace, BloggingStudioWorkspace } from "./features/content/ContentOpsWorkspace";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/trpc";
const LOCAL_USER_ID = "local-dev-user";

function renderWorkspace(active: WorkspaceId) {
  switch (active) {
    case "script-studio":
    case "drafts":
      return <ScriptStudioWorkspace />;
    case "blogging":
      return <BloggingStudioWorkspace />;
    case "claim-ledger":
    case "evidence":
      return <ClaimLedgerWorkspace />;
    case "god-machine":
      return <GodMachineWorkspace />;
    case "idea-ide":
      return <IdeWorkspace />;
    case "workspace":
      return <ContentOpsWorkspace />;
    case "overview":
      return <OverviewWorkspace />;
    case "learn":
      return <LearnWorkspace />;
    case "automations":
      return <AutomationsPipelineWorkspace variant="automations" />;
    case "research-to-post":
      return <AutomationsPipelineWorkspace variant="research-to-post" />;
    case "youtube-automode":
    case "youtube":
      return <VideoAutopilotWorkspace />;
    case "shorts-reels":
      return <ContentOpsStudio focus="studio" />;
    case "research":
      return <ContentOpsStudio focus="research" />;
    case "approvals":
      return <ContentOpsStudio focus="approvals" />;
    case "publishing":
      return <ContentOpsStudio focus="publishing" />;
    case "social-manager":
      return <SocialManagerWorkspace />;
    case "templates":
      return <TemplateLibraryWorkspace />;
    case "plugins":
      return <PluginsWorkspace mode="plugins" />;
    case "credentials":
      return <PluginsWorkspace mode="credentials" />;
    case "activity":
      return <ActivityWorkspace />;
    case "inbox":
      return <InboxWorkspace />;
    case "calendar":
      return <CalendarWorkspace />;
    case "settings":
      return <SettingsWorkspace />;
    case "governance":
      return <GovernanceWorkspace />;
    default:
      return <OverviewWorkspace />;
  }
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: API_URL,
          headers() {
            return { "x-user-id": LOCAL_USER_ID };
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppShell>{(active) => renderWorkspace(active)}</AppShell>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
