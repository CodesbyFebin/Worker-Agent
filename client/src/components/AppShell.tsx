import { useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  FileText,
  Folder,
  GitBranch,
  Inbox,
  KeyRound,
  LayoutGrid,
  Library,
  MonitorSmartphone,
  PenLine,
  Play,
  Plug,
  RefreshCw,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Upload,
  Video,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { WorkerAgentLogo } from "./WorkerAgentLogo";
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

const CONTROL_PLANE: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "god-machine", label: "Missions", icon: Workflow },
  { id: "research", label: "Intelligence", icon: MonitorSmartphone },
  { id: "workspace", label: "Content", icon: Folder },
  { id: "youtube", label: "Channels", icon: Play },
  { id: "automations", label: "Automation", icon: Zap },
  { id: "governance", label: "Governance", icon: ShieldCheck },
  { id: "learn", label: "Learn Loop", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

const ADVANCED: NavItem[] = [
  { id: "script-studio", label: "Script Studio", icon: FileText },
  { id: "claim-ledger", label: "Claim Ledger", icon: ShieldCheck },
  { id: "idea-ide", label: "IDEa IDE", icon: MonitorSmartphone },
  { id: "youtube-automode", label: "YouTube Autopilot", icon: Video },
  { id: "youtube-studio", label: "YT Studio", icon: Video },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "tools-mcp", label: "Tools & MCP", icon: Wrench },
  { id: "research-to-post", label: "Research-to-Post", icon: GitBranch },
  { id: "shorts-reels", label: "Shorts & Reels", icon: Smartphone },
  { id: "social-manager", label: "Social Manager", icon: Share2 },
  { id: "blogging", label: "Blogging Studio", icon: PenLine },
  { id: "drafts", label: "Drafts", icon: FileText },
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

function NavButton({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.label}
      className={`relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[12px] ${collapsed ? "justify-center" : ""} ${
        active
          ? "border border-[#7164ff]/25 bg-[#7164ff]/12 text-white shadow-[inset_3px_0_0_#7164ff]"
          : "border border-transparent text-[var(--color-text-muted)] hover:bg-white/[0.035] hover:text-white"
      }`}
    >
      <Icon size={15} className={active ? "text-[#8175ff]" : undefined} />
      {!collapsed && <span className="hidden truncate font-medium lg:inline">{item.label}</span>}
    </button>
  );
}

export function AppShell({ children }: { children: (active: WorkspaceId) => ReactNode }) {
  const [active, setActive] = useState<WorkspaceId>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [focusScriptId, setFocusScriptId] = useState<string | null>(null);
  const [focusPipelineId, setFocusPipelineId] = useState<string | null>(null);
  const chromeLess = FULL_BLEED.includes(active);
  const showPipeline = active !== "overview";

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
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-ink)] text-[var(--color-text-primary)]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-[#050608]/95 px-3.5 backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-4">
            <WorkerAgentLogo size={27} />
            <div className="hidden h-5 w-px bg-[var(--color-line)] sm:block" />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)] shadow-[var(--glow-green)]" />
              <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Control plane</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-medium text-white">Operator</p>
              <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Organization session</p>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full border border-[#7164ff]/30 bg-[#7164ff]/12 text-[10px] font-semibold text-white">OP</div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <nav className={`relative flex shrink-0 flex-col border-r border-[var(--color-line)] bg-[#07090d]/96 py-3 transition-all ${collapsed ? "w-14 items-center px-1" : "w-14 items-center lg:w-52 lg:items-stretch lg:px-2"}`}>
            {!collapsed && <p className="mb-2 hidden px-3 font-[var(--font-mono)] text-[8px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] lg:block">Mission Control</p>}
            <div className={`flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
              {CONTROL_PLANE.map((item) => (
                <NavButton key={item.id} item={item} active={active === item.id} collapsed={collapsed} onClick={() => setActive(item.id)} />
              ))}
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {!collapsed && (
                <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="hidden w-full items-center justify-between rounded-lg px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:bg-white/[0.025] hover:text-white lg:flex">
                  Advanced workspaces
                  <ChevronDown size={13} className={advancedOpen ? "rotate-180" : ""} />
                </button>
              )}
              {(collapsed || advancedOpen) && (
                <div className={`mt-1 flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
                  {ADVANCED.map((item) => (
                    <NavButton key={item.id} item={item} active={active === item.id} collapsed={collapsed} onClick={() => setActive(item.id)} />
                  ))}
                </div>
              )}
            </div>

            <div className={`mt-3 border-t border-[var(--color-line)] pt-3 ${collapsed ? "flex flex-col items-center" : "px-2"}`}>
              {!collapsed && (
                <div className="mb-2 hidden rounded-lg border border-[var(--color-line)] bg-black/25 px-3 py-2 lg:block">
                  <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-wider text-[var(--color-text-muted)]">Runtime status</p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">Use workspace feeds for live state.</p>
                </div>
              )}
              <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex items-center gap-2 rounded-lg p-2 text-[10px] text-[var(--color-text-muted)] hover:bg-white/[0.035] hover:text-white" title={collapsed ? "Expand navigation" : "Collapse navigation"}>
                <ChevronLeft size={14} className={collapsed ? "rotate-180" : ""} />
                {!collapsed && <span className="hidden lg:inline">Collapse</span>}
              </button>
            </div>
          </nav>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {showPipeline && <ContentPipelineBar />}
            <div className={`min-h-0 flex-1 ${chromeLess ? "overflow-hidden p-0" : "overflow-y-auto p-6"}`}>{children(active)}</div>
          </main>
        </div>
      </div>
    </WorkspaceNavProvider>
  );
}
