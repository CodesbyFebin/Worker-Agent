import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import { AppShell, type WorkspaceId } from "./components/AppShell";
import { AuthGate } from "./components/AuthGate";
import { OrgSessionBar } from "./components/OrgSessionBar";
import { LandingPage } from "./marketing/LandingPage";
import { CommandCenter } from "./mission-control/CommandCenter";
import { ScriptStudioWorkspace } from "./features/script-studio/ScriptStudioWorkspace";
import { EvidenceArtifactsWorkspace } from "./features/evidence/EvidenceArtifactsWorkspace";
import { GodMachineWorkspace } from "./features/god-machine/GodMachineWorkspace";
import { IdeWorkspace } from "./features/idea-ide/IdeWorkspace";
import { ContentOpsStudio } from "./features/youtube-automode/ContentOpsStudio";
import { VideoAutopilotWorkspace } from "./features/youtube-automode/VideoAutopilotWorkspace";
import { YoutubeStudioWorkspace } from "./features/youtube-studio/YoutubeStudioWorkspace";
import { OverviewWorkspace } from "./features/overview/OverviewWorkspace";
import { LearnWorkspace } from "./features/learn/LearnWorkspace";
import { PluginsWorkspace } from "./features/plugins/PluginsWorkspace";
import { AutomationsPipelineWorkspace } from "./features/automations/AutomationsPipelineWorkspace";
import { AgentsWorkspace } from "./features/agents/AgentsWorkspace";
import { ToolsGatewayWorkspace } from "./features/tools/ToolsGatewayWorkspace";
import { TemplateLibraryWorkspace } from "./features/templates/TemplateLibraryWorkspace";
import { SocialManagerWorkspace } from "./features/social/SocialManagerWorkspace";
import { ActivityWorkspace, InboxWorkspace } from "./features/activity/ActivityWorkspace";
import { CalendarWorkspace, SettingsWorkspace } from "./features/ops/OpsWorkspaces";
import { GovernanceWorkspace } from "./features/ops/GovernanceWorkspace";
import { RecoveryWorkspace } from "./features/ops/RecoveryWorkspace";
import { ContentOpsWorkspace, BloggingStudioWorkspace } from "./features/content/ContentOpsWorkspace";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/trpc";

const PATH_TO_WORKSPACE: Record<string, WorkspaceId> = {
  "/": "overview",
  "/dashboard": "overview",
  "/missions": "god-machine",
  "/intelligence": "research",
  "/content": "workspace",
  "/channels": "youtube",
  "/automation": "automations",
  "/governance": "governance",
  "/learn": "learn",
  "/settings": "settings",
};

const WORKSPACE_TO_PATH: Record<WorkspaceId, string> = {
  "overview": "/dashboard",
  "god-machine": "/missions",
  "research": "/intelligence",
  "workspace": "/content",
  "youtube": "/channels",
  "automations": "/automation",
  "governance": "/governance",
  "learn": "/learn",
  "settings": "/settings",
  // advanced workspaces fall back to overview
  "script-studio": "/dashboard",
  "claim-ledger": "/dashboard",
  "idea-ide": "/dashboard",
  "youtube-automode": "/dashboard",
  "youtube-studio": "/dashboard",
  "shorts-reels": "/dashboard",
  "social-manager": "/dashboard",
  "blogging": "/dashboard",
  "drafts": "/dashboard",
  "evidence": "/dashboard",
  "approvals": "/dashboard",
  "publishing": "/dashboard",
  "templates": "/dashboard",
  "plugins": "/dashboard",
  "credentials": "/dashboard",
  "activity": "/dashboard",
  "recovery": "/dashboard",
  "inbox": "/dashboard",
  "calendar": "/dashboard",
  "agents": "/dashboard",
  "tools-mcp": "/dashboard",
  "research-to-post": "/dashboard",
};

function getWorkspaceFromPath(pathname: string): WorkspaceId {
  if (PATH_TO_WORKSPACE[pathname]) return PATH_TO_WORKSPACE[pathname];
  if (pathname.startsWith("/missions/")) return "god-machine";
  return "overview";
}

function getPathFromWorkspace(workspace: WorkspaceId): string {
  return WORKSPACE_TO_PATH[workspace] ?? "/dashboard";
}

function renderWorkspace(active: WorkspaceId) {
  switch (active) {
    case "script-studio":
    case "drafts":
      return <ScriptStudioWorkspace />;
    case "blogging":
      return <BloggingStudioWorkspace />;
    case "claim-ledger":
      return <EvidenceArtifactsWorkspace mode="ledger" />;
    case "evidence":
      return <EvidenceArtifactsWorkspace mode="evidence" />;
    case "god-machine":
      return <GodMachineWorkspace />;
    case "idea-ide":
      return <IdeWorkspace />;
    case "workspace":
      return <ContentOpsWorkspace />;
    case "overview":
      return <CommandCenter />;
    case "learn":
      return <LearnWorkspace />;
    case "automations":
      return <AutomationsPipelineWorkspace variant="automations" />;
    case "agents":
      return <AgentsWorkspace />;
    case "tools-mcp":
      return <ToolsGatewayWorkspace />;
    case "research-to-post":
      return <AutomationsPipelineWorkspace variant="research-to-post" />;
    case "youtube-automode":
    case "youtube":
      return <VideoAutopilotWorkspace />;
    case "youtube-studio":
      return <YoutubeStudioWorkspace />;
    case "shorts-reels":
      return <ContentOpsStudio focus="studio" />;
    case "research":
      return <ContentOpsStudio focus="research" />;
    case "approvals":
      return <GovernanceWorkspace initialTab="approvals" />;
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
    case "recovery":
      return <RecoveryWorkspace />;
    case "inbox":
      return <InboxWorkspace />;
    case "calendar":
      return <CalendarWorkspace />;
    case "settings":
      return <SettingsWorkspace />;
    case "governance":
      return <GovernanceWorkspace initialTab="policy" />;
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
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" });
          },
        }),
      ],
    }),
  );

  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>(() => getWorkspaceFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setActiveWorkspace(getWorkspaceFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((workspace: WorkspaceId) => {
    const path = getPathFromWorkspace(workspace);
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setActiveWorkspace(workspace);
  }, []);

  const isPublicLanding = window.location.pathname === "/";

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {isPublicLanding ? (
          <LandingPage onLaunchApp={() => window.location.assign("/dashboard")} />
        ) : (
          <AuthGate>
            <div className="flex h-screen min-h-0 flex-col">
              <OrgSessionBar />
              <div className="min-h-0 flex-1">
                <AppShell active={activeWorkspace} onNavigate={navigate}>
                  {(active) => renderWorkspace(active)}
                </AppShell>
              </div>
            </div>
          </AuthGate>
        )}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
