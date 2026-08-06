import { useState, type ReactNode } from "react";
import {
  LayoutGrid,
  Folder,
  Zap,
  Bot,
  Wrench,
  Play,
  Smartphone,
  Search,
  Pencil,
  ShieldCheck,
  CheckCircle2,
  Upload,
  BookOpen,
  FileText,
  Workflow,
  MonitorSmartphone,
  CalendarClock,
  Film,
  ChevronLeft,
  Plug,
  Library,
  Share2,
  Activity,
  Calendar,
  Inbox,
  Settings,
  PenLine,
  GitBranch,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { WorkerAgentLogo } from "./WorkerAgentLogo";
import { AgentRail } from "./AgentRail";
import { WorkspaceNavProvider } from "./WorkspaceNavContext";
import { ContentPipelineBar } from "./ContentPipelineBar";

export type WorkspaceId =
  | "script-studio"
  | "claim-ledger"
  | "god-machine"
  | "idea-ide"
  | "youtube-automode"
  | "youtube-studio"
  | "overview"
  | "workspace"
  | "automations"
  | "agents"
  | "tools-mcp"
  | "research-to-post"
  | "youtube"
  | "shorts-reels"
  | "social-manager"
  | "research"
  | "drafts"
  | "blogging"
  | "evidence"
  | "approvals"
  | "publishing"
  | "templates"
  | "plugins"
  | "credentials"
  | "activity"
  | "recovery"
  | "calendar"
  | "inbox"
  | "learn"
  | "settings"
  | "governance";

type NavItem = { id: WorkspaceId; label: string; icon: typeof FileText };

const PLATFORM: NavItem[] = [
  { id: "script-studio", label: "Script Studio", icon: FileText },
  { id: "claim-ledger", label: "Claim Ledger", icon: ShieldCheck },
  { id: "god-machine", label: "God Machine", icon: Workflow },
  { id: "idea-ide", label: "IDEa IDE", icon: MonitorSmartphone },
  { id: "youtube-automode", label: "YouTube Autopilot", icon: CalendarClock },
  { id: "youtube-studio", label: "YT Studio", icon: Film },
];

const CONTENT_OPS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "workspace", label: "Workspace", icon: Folder },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "tools-mcp", label: "Tools & MCP", icon: Wrench },
  { id: "research-to-post", label: "Research-to-Post", icon: GitBranch },
  { id: "youtube", label: "Autopilot", icon: Play },
  { id: "shorts-reels", label: "Shorts & Reels", icon: Smartphone },
  { id: "social-manager", label: "Social Manager", icon: Share2 },
  { id: "blogging", label: "Blogging Studio", icon: PenLine },
  { id: "research", label: "Research", icon: Search },
  { id: "drafts", label: "Drafts", icon: Pencil },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
  { id: "approvals", label: "Approvals", icon: CheckCircle2 },
  { id: "publishing", label: "Publishing", icon: Upload },
  { id: "templates", label: "Template Library", icon: Library },
  { id: "plugins", label: "Plugins & Connectors", icon: Plug },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "recovery", label: "Recovery", icon: RefreshCw },
  { id: "governance", label: "Governance", icon: ShieldCheck },
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

const FULL_BLEED: WorkspaceId[] = [
  "idea-ide",
  "god-machine",
  "claim-ledger",
  "youtube-automode",
  "youtube-studio",
  "shorts-reels",
  "youtube",
  "research",
  "approvals",
  "publishing",
  "overview",
  "automations",
  "agents",
  "tools-mcp",
  "research-to-post",
  "social-manager",
  "plugins",
  "credentials",
  "templates",
  "workspace",
  "blogging",
  "calendar",
  "inbox",
  "activity",
  "recovery",
  "governance",
  "settings",
];

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.label}
      className={`relative flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] transition-all ${
        collapsed ? "justify-center" : "lg:px-3"
      } ${
        active
          ? "bg-[var(--color-violet)]/15 text-[var(--color-text-primary)] shadow-[var(--glow-magenta)] ring-1 ring-[var(--color-violet)]/45"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 hidden h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-violet)] lg:block" />
      )}
      <Icon size={16} className={active ? "text-[var(--color-violet)]" : undefined} />
      {!collapsed && <span className="hidden truncate font-medium lg:inline">{item.label}</span>}
    </button>
  );
}

export function AppShell({ children }: { children: (active: WorkspaceId) => ReactNode }) {
  const [active, setActive] = useState<WorkspaceId>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [focusScriptId, setFocusScriptId] = useState<string | null>(null);
  const [focusPipelineId, setFocusPipelineId] = useState<string | null>(null);
  const chromeLess = FULL_BLEED.includes(active);

  const navValue = {
    active,
    setActive,
    focusScriptId,
    setFocusScriptId,
    focusPipelineId,
    setFocusPipelineId,
  };

  return (
    <WorkspaceNavProvider value={navValue}>
      <div className="flex h-screen overflow-hidden text-[var(--color-text-primary)]">
        <nav
          className={`relative flex shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]/95 py-3 backdrop-blur-md transition-all ${
            collapsed ? "w-14 items-center px-1" : "w-14 items-center lg:w-56 lg:items-stretch lg:px-2"
          }`}
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-[var(--color-violet)] via-[var(--color-teal)] to-[var(--color-amber)] opacity-40" />

          <div className={`mb-3 ${collapsed ? "flex justify-center" : "px-1"}`}>
            {collapsed ? (
              <WorkerAgentLogo size={28} showWordmark={false} />
            ) : (
              <div className="hidden lg:block">
                <WorkerAgentLogo size={28} />
              </div>
            )}
            {!collapsed && (
              <div className="flex justify-center lg:hidden">
                <WorkerAgentLogo size={28} showWordmark={false} />
              </div>
            )}
          </div>

          {!collapsed && (
            <p className="mb-1 hidden px-3 font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] lg:block">
              Platform
            </p>
          )}
          <div className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`}>
            {PLATFORM.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={active === item.id}
                collapsed={collapsed}
                onClick={() => setActive(item.id)}
              />
            ))}
          </div>

          <div className="my-2 mx-2 hidden h-px bg-[var(--color-line)] lg:block" />

          {!collapsed && (
            <p className="mb-1 hidden px-3 font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] lg:block">
              Content Ops
            </p>
          )}
          <div
            className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5"}`}
          >
            {CONTENT_OPS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={active === item.id}
                collapsed={collapsed}
                onClick={() => setActive(item.id)}
              />
            ))}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="mt-2 hidden items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] lg:flex"
            >
              <ChevronLeft size={14} />
              Collapse
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="mt-2 rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              title="Expand"
            >
              <ChevronLeft size={14} className="rotate-180" />
            </button>
          )}
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ContentPipelineBar />
          <div className={`min-h-0 flex-1 ${chromeLess ? "overflow-hidden p-0" : "overflow-y-auto p-6"}`}>
            {children(active)}
          </div>
        </main>

        {!chromeLess && <AgentRail />}
      </div>
    </WorkspaceNavProvider>
  );
}
