import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileCode2,
  Folder,
  FolderOpen,
  Play,
  Terminal as TerminalIcon,
  GitBranch,
  Circle,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { ModelChooser } from "../../components/ModelChooser";
import { MonacoEditorPane } from "./MonacoEditorPane";
import { IdeTerminalPanel } from "./IdeTerminalPanel";
import { IdeWorktreesPanel } from "./IdeWorktreesPanel";
import { IdePatchReviewPanel } from "./IdePatchReviewPanel";
import { IdeBrowserPreview } from "./IdeBrowserPreview";
import { IdeAgentInspector } from "./IdeAgentInspector";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/trpc").replace(/\/trpc\/?$/, "");

const STATUS_DOT: Record<string, string> = {
  idle: "bg-[var(--color-text-muted)]",
  pending: "bg-[var(--color-text-muted)]",
  assigned: "bg-[var(--color-amber)]",
  running: "bg-[var(--color-amber)] animate-pulse",
  awaiting_approval: "bg-[var(--color-violet)]",
  blocked: "bg-[var(--color-coral)]",
  failed: "bg-[var(--color-coral)]",
  completed: "bg-[var(--color-teal)]",
};

const ROLE_LABEL: Record<string, string> = {
  planner: "Planner",
  researcher: "Research",
  writer: "Writer",
  reviewer: "Reviewer",
  coder: "Code",
  qa: "Test / QA",
  publisher: "Deploy / Publish",
  video_generator: "Video Gen",
  video_editor: "Video Edit",
  voiceover: "Voiceover",
  caption_hashtag: "Captions",
  seo: "SEO",
};

type CmdTab = "chat" | "plan" | "inspect" | "tools";
type BottomTab = "workflow" | "terminal" | "patches" | "worktrees" | "preview" | "models";

function TreeNode({
  entryPath,
  name,
  kind,
  depth,
  openFile,
  activePath,
}: {
  entryPath: string;
  name: string;
  kind: "file" | "dir";
  depth: number;
  openFile: (p: string) => void;
  activePath: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { data } = trpc.ide.listTree.useQuery(
    { path: entryPath },
    { enabled: kind === "dir" && open },
  );

  if (kind === "file") {
    return (
      <button
        type="button"
        onClick={() => openFile(entryPath)}
        className={`flex w-full items-center gap-1.5 truncate px-2 py-0.5 text-left text-[12px] ${
          activePath === entryPath
            ? "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <FileCode2 size={12} className="shrink-0 opacity-70" />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 truncate px-2 py-0.5 text-left text-[12px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? <FolderOpen size={12} className="text-[var(--color-amber)]" /> : <Folder size={12} />}
        <span className="truncate">{name}</span>
      </button>
      {open &&
        data?.entries.map((e) => (
          <TreeNode
            key={e.path}
            entryPath={e.path}
            name={e.name}
            kind={e.kind}
            depth={depth + 1}
            openFile={openFile}
            activePath={activePath}
          />
        ))}
    </div>
  );
}

function IdeModelsPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, error } = trpc.ide.listLlmProviders.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const { data: orFree } = trpc.settings.listOpenRouterFree.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const setLlm = trpc.settings.setLlm.useMutation({
    onSuccess: () => {
      utils.ide.listLlmProviders.invalidate();
      utils.settings.getLlm.invalidate();
    },
  });

  if (isLoading) return <p className="text-[12px] text-[var(--color-text-muted)]">Loading providers…</p>;
  if (isError) return <p className="text-[12px] text-[var(--color-coral)]">{error.message}</p>;
  if (!data) return null;

  const orModels = orFree?.models?.length
    ? orFree.models
    : (data.freeCloudModels ?? [])
        .filter((m) => m.provider === "openrouter")
        .map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-3 text-[12px]">
      <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
        Routing · LLM_PROVIDER={data.activeProvider}
        {data.modelOverride ? ` · model=${data.modelOverride}` : ""}
      </p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Click a free OpenRouter model to pin it for God Machine + all agents.
      </p>

      <div className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2">
        <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-teal)]">
          OpenRouter free ({orModels.length})
        </p>
        <div className="mt-2 max-h-40 overflow-y-auto font-mono text-[10px]">
          {orModels.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={setLlm.isPending}
              onClick={() => setLlm.mutate({ provider: "openrouter", model: m.id })}
              className="flex w-full gap-2 border-b border-[var(--color-line)]/40 py-0.5 text-left hover:bg-[var(--color-surface-raised)]"
            >
              <span className="truncate text-[var(--color-text-primary)]" title={m.name}>
                {m.id}
              </span>
            </button>
          ))}
          {!orModels.length && (
            <p className="text-[var(--color-text-muted)]">No free models — set OPENROUTER_API_KEY</p>
          )}
        </div>
      </div>

      {data.providers.map((p) => (
        <div
          key={p.id}
          className="flex items-start justify-between gap-3 rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-[var(--color-text-primary)]">
              {p.label}
              {p.free ? (
                <span className="ml-2 text-[10px] uppercase text-[var(--color-teal)]">free</span>
              ) : (
                <span className="ml-2 text-[10px] uppercase text-[var(--color-amber)]">paid key</span>
              )}
            </p>
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">{p.defaultModel}</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{p.note}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setLlm.mutate({
                provider: p.id as
                  | "openrouter"
                  | "ollama"
                  | "groq"
                  | "gemini"
                  | "anthropic"
                  | "nvidia"
                  | "pollinations",
              })
            }
            className="shrink-0 rounded border border-[var(--color-line)] px-2 py-1 text-[10px] hover:border-[var(--color-violet)]/50"
          >
            Use
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * IDEa UI — IDE chrome matching the agentic-IDE mockups, wired to real
 * roster / God Machine / repo filesystem. No fake star counts or GPU meters.
 */
export function IdeWorkspace() {
  const utils = trpc.useUtils();
  const { data: treeRoot, isError: treeError, error: treeErr, isLoading: treeLoading } = trpc.ide.listTree.useQuery({
    path: "",
  });
  const { data: roster } = trpc.ide.roster.useQuery(undefined, { refetchInterval: 3000 });
  const { data: summary } = trpc.ide.costSummary.useQuery(undefined, { refetchInterval: 5000 });
  const { data: awaiting } = trpc.ide.listAwaitingApproval.useQuery(undefined, { refetchInterval: 4000 });
  const { data: recent } = trpc.ide.listRecent.useQuery({ limit: 30 }, { refetchInterval: 4000 });

  const [tabs, setTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [cmdTab, setCmdTab] = useState<CmdTab>("chat");
  const [bottomTab, setBottomTab] = useState<BottomTab>("workflow");
  const [goal, setGoal] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ role: "user" | "system"; text: string }>>([
    {
      role: "system",
      text: "IDEa is connected to WorkerAgent.Cloud God Machine. Describe a goal — the planner agent will decompose it into real subtasks.",
    },
  ]);
  const [rootTaskId, setRootTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<"connecting" | "live" | "down">("connecting");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fileQuery = trpc.ide.readFile.useQuery(
    { path: activeFile! },
    { enabled: Boolean(activeFile) },
  );

  const writeFile = trpc.ide.writeFile.useMutation({
    onSuccess: async () => {
      setSaveMsg("Saved");
      if (activeFile) await utils.ide.readFile.invalidate({ path: activeFile });
    },
    onError: (e) => setSaveMsg(e.message),
  });

  const handleSave = useCallback(
    async (content: string) => {
      if (!activeFile) return;
      await writeFile.mutateAsync({ path: activeFile, content });
    },
    [activeFile, writeFile],
  );

  const treeQuery = trpc.godMachine.getTaskTree.useQuery(
    { rootTaskId: rootTaskId! },
    { enabled: Boolean(rootTaskId), refetchInterval: 2500 },
  );

  const dispatch = trpc.godMachine.dispatchGoal.useMutation({
    onSuccess: (result) => {
      setRootTaskId(result.rootTaskId);
      setCmdTab("plan");
      setChatLog((prev) => [
        ...prev,
        {
          role: "system",
          text: `Planner created root task ${result.rootTaskId.slice(0, 8)}… — open Plan for the live tree.`,
        },
      ]);
      void utils.ide.roster.invalidate();
      void utils.ide.listRecent.invalidate();
    },
    onError: (err) => {
      setChatLog((prev) => [...prev, { role: "system", text: `Error: ${err.message}` }]);
    },
  });

  const runSubtask = trpc.godMachine.runSubtask.useMutation({
    onSuccess: () => {
      if (rootTaskId) void utils.godMachine.getTaskTree.invalidate({ rootTaskId });
    },
  });

  useEffect(() => {
    const es = new EventSource(`${API_ORIGIN}/events`);
    es.onopen = () => setSseStatus("live");
    es.onerror = () => setSseStatus("down");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type?: string; message?: string; eventType?: string };
        if (data.type === "connected") return;
        if (data.message) {
          setChatLog((prev) => {
            const line = `[${data.eventType ?? "event"}] ${data.message}`;
            if (prev[prev.length - 1]?.text === line) return prev;
            return [...prev.slice(-80), { role: "system", text: line }];
          });
        }
      } catch {
        /* ignore */
      }
      void utils.ide.roster.invalidate();
      void utils.ide.listRecent.invalidate();
      void utils.ide.costSummary.invalidate();
      if (rootTaskId) void utils.godMachine.getTaskTree.invalidate({ rootTaskId });
    };
    return () => es.close();
  }, [utils, rootTaskId]);

  function openFile(p: string) {
    setActiveFile(p);
    setTabs((prev) => (prev.includes(p) ? prev : [...prev, p]));
  }

  function closeTab(p: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== p);
      if (activeFile === p) setActiveFile(next[next.length - 1] ?? null);
      return next;
    });
  }

  function submitGoal() {
    const g = goal.trim();
    if (!g) return;
    setChatLog((prev) => [...prev, { role: "user", text: g }]);
    setGoal("");
    dispatch.mutate({ goal: g });
  }

  const activeAgents = useMemo(
    () => (roster ?? []).filter((a) => a.status === "running" || a.status === "assigned").length,
    [roster],
  );

  const workflowNodes = useMemo(() => {
    if (treeQuery.data?.subtasks?.length) {
      return treeQuery.data.subtasks.map((t) => ({
        id: t.id,
        label: t.agentRole,
        status: t.status as string,
      }));
    }
    return (roster ?? []).slice(0, 8).map((a) => ({
      id: a.role,
      label: a.role,
      status: a.status,
    }));
  }, [treeQuery.data, roster]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0c12] text-[var(--color-text-primary)]">
      {/* Title bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3">
        <div className="flex items-center gap-2">
          <span className="font-[var(--font-display)] text-xs tracking-widest text-[var(--color-teal)]">
            idea
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)]">AGENTIC IDE</span>
          <span className="hidden rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] sm:inline">
            Claude Sonnet · WorkerAgent.Cloud
          </span>
        </div>
        <div className="mx-4 hidden max-w-md flex-1 md:block">
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-1 text-center text-[11px] text-[var(--color-text-muted)]">
            Ask anything or dispatch a God Machine goal…
          </div>
        </div>
        <div className="flex items-center gap-3 font-[var(--font-display)] text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          <ModelChooser compact />
          <span className={sseStatus === "live" ? "text-[var(--color-teal)]" : "text-[var(--color-coral)]"}>
            SSE {sseStatus}
          </span>
          <span>{activeAgents} agents live</span>
        </div>
      </div>

      {/* Main IDE body */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Explorer + Swarm */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] lg:w-64">
          <div className="border-b border-[var(--color-line)] px-3 py-2">
            <p className="font-[var(--font-display)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Explorer
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-text-muted)]" title={treeRoot?.root}>
              {treeRoot?.root?.split(/[/\\]/).slice(-2).join("/") ?? "…"}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {treeLoading && (
              <p className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">Loading tree…</p>
            )}
            {treeError && (
              <p className="px-3 py-2 text-[11px] text-[var(--color-coral)]">{treeErr.message}</p>
            )}
            {(treeRoot?.entries ?? []).map((e) => (
              <TreeNode
                key={e.path}
                entryPath={e.path}
                name={e.name}
                kind={e.kind}
                depth={0}
                openFile={openFile}
                activePath={activeFile}
              />
            ))}
            {treeRoot && treeRoot.entries.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">Empty directory</p>
            )}
          </div>

          <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-[var(--color-line)]">
            <div className="px-3 py-2">
              <p className="font-[var(--font-display)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Agent swarm
              </p>
            </div>
            {(roster ?? []).map((agent) => (
              <button
                key={agent.role}
                type="button"
                onClick={() => agent.latestTask && setSelectedTaskId(agent.latestTask.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-surface-raised)]"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[agent.status] ?? STATUS_DOT.idle}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-[var(--color-text-primary)]">
                    {ROLE_LABEL[agent.role] ?? agent.role}
                  </p>
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {!agent.latestTask ? "Idle" : agent.latestTask.title ?? agent.status}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: editor */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--color-ink)]">
          <div className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[var(--color-line)] bg-[var(--color-surface)] px-1">
            {tabs.length === 0 && (
              <span className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">No file open</span>
            )}
            {tabs.map((t) => (
              <div
                key={t}
                className={`flex items-center gap-2 border-r border-[var(--color-line)] px-3 py-1.5 text-[11px] ${
                  activeFile === t
                    ? "bg-[var(--color-ink)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <button type="button" onClick={() => setActiveFile(t)} className="max-w-[10rem] truncate">
                  {t.split("/").pop()}
                </button>
                <button type="button" onClick={() => closeTab(t)} className="opacity-50 hover:opacity-100">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {!activeFile && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="font-[var(--font-display)] text-sm tracking-wide text-[var(--color-text-primary)]">
                  Build with your agent team
                </p>
                <p className="max-w-md text-xs text-[var(--color-text-muted)]">
                  Open a file from the explorer (Monaco), run allowlisted tests in Terminal, review
                  patches, manage worktrees, or preview the app. Swarm status comes from real
                  `agent_tasks`.
                </p>
              </div>
            )}
            {activeFile && fileQuery.isLoading && (
              <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</p>
            )}
            {activeFile && fileQuery.isError && (
              <p className="p-4 text-sm text-[var(--color-coral)]">{fileQuery.error.message}</p>
            )}
            {activeFile && fileQuery.data && (
              <MonacoEditorPane
                path={activeFile}
                content={fileQuery.data.content}
                truncated={fileQuery.data.truncated}
                onSave={handleSave}
                saving={writeFile.isPending}
              />
            )}
            {saveMsg && (
              <p className="absolute bottom-2 right-2 rounded bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-text-muted)]">
                {saveMsg}
              </p>
            )}
          </div>
        </section>

        {/* Right: Command Center */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)] lg:w-80">
          <div className="flex border-b border-[var(--color-line)]">
            {(["chat", "plan", "inspect", "tools"] as CmdTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCmdTab(t)}
                className={`flex-1 py-2 font-[var(--font-display)] text-[10px] uppercase tracking-wide ${
                  cmdTab === t
                    ? "border-b-2 border-[var(--color-teal)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cmdTab === "chat" && (
              <div className="flex h-full flex-col gap-2">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {chatLog.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-md px-2 py-1.5 text-[12px] ${
                        m.role === "user"
                          ? "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitGoal()}
                    placeholder="Describe a goal…"
                    className="min-w-0 flex-1 rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                  <button
                    type="button"
                    disabled={dispatch.isPending || !goal.trim()}
                    onClick={submitGoal}
                    className="rounded bg-[var(--color-teal)] px-2 text-[var(--color-ink)] disabled:opacity-40"
                    title="Dispatch"
                  >
                    <Play size={14} />
                  </button>
                </div>
              </div>
            )}

            {cmdTab === "plan" && (
              <div className="space-y-2">
                {!rootTaskId && (
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    Dispatch a goal from Chat to see the planner’s task tree here.
                  </p>
                )}
                {treeQuery.data && (
                  <>
                    <p className="text-[12px] text-[var(--color-text-primary)]">{treeQuery.data.root.title}</p>
                    <ul className="space-y-1">
                      {treeQuery.data.subtasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-start justify-between gap-2 rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                        >
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => setSelectedTaskId(t.id)}
                          >
                            <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
                              {t.agentRole}
                            </p>
                            <p className="truncate text-[11px]">{t.title}</p>
                          </button>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
                            {["pending", "blocked", "failed"].includes(t.status) && (
                              <button
                                type="button"
                                className="text-[10px] text-[var(--color-teal)]"
                                onClick={() => runSubtask.mutate({ taskId: t.id })}
                              >
                                Run
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {cmdTab === "inspect" && <IdeAgentInspector taskId={selectedTaskId} />}

            {cmdTab === "tools" && (
              <div className="space-y-3 text-[12px]">
                <p className="text-[var(--color-text-muted)]">Wired integrations (real status):</p>
                <ul className="space-y-1 text-[var(--color-text-primary)]">
                  <li>· Monaco editor + path-safe write (`script:write`)</li>
                  <li>· Allowlisted terminal (typecheck / lint / test / git)</li>
                  <li>· Git worktrees (`GOD_MACHINE_REPO_ROOT`)</li>
                  <li>· Patch review + PR draft / open (needs GITHUB_*)</li>
                  <li>· Browser preview iframe</li>
                </ul>
                {awaiting && awaiting.length > 0 && (
                  <div className="rounded border border-[var(--color-violet)] p-2">
                    <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-violet)]">
                      Needs you
                    </p>
                    {awaiting.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="mt-1 block text-left text-[11px] hover:underline"
                        onClick={() => {
                          setSelectedTaskId(t.id);
                          setCmdTab("inspect");
                        }}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
                    Recent tasks
                  </p>
                  {(recent ?? []).slice(0, 10).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setCmdTab("inspect");
                      }}
                      className="mt-1 block w-full rounded border border-[var(--color-line)] px-2 py-1 text-left hover:bg-[var(--color-ink)]"
                    >
                      <p className="truncate text-[11px]">{t.title}</p>
                      <p className="font-[var(--font-display)] text-[10px] text-[var(--color-text-muted)]">
                        {t.agentRole} · {t.status}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom panel */}
      <div className="flex h-52 shrink-0 flex-col border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-line)] px-2">
          {(
            [
              ["workflow", "Workflow"],
              ["terminal", "Terminal"],
              ["patches", "Patches"],
              ["worktrees", "Worktrees"],
              ["preview", "Preview"],
              ["models", "Models"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBottomTab(id)}
              className={`shrink-0 px-3 py-1.5 font-[var(--font-display)] text-[10px] uppercase tracking-wide ${
                bottomTab === id ? "text-[var(--color-teal)]" : "text-[var(--color-text-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 pr-2 font-[var(--font-display)] text-[10px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <TerminalIcon size={10} /> API :4000
            </span>
            <span className="flex items-center gap-1">
              <GitBranch size={10} /> agents {summary?.running ?? 0}
            </span>
            <span>
              tokens {((summary?.inputTokens ?? 0) + (summary?.outputTokens ?? 0)).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {bottomTab === "workflow" && (
            <div className="flex h-full flex-wrap items-center gap-2">
              <div className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-text-muted)]">
                Goal
              </div>
              {workflowNodes.map((n, i) => (
                <div key={n.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[var(--color-text-muted)]">→</span>}
                  <button
                    type="button"
                    onClick={() => {
                      if (n.id.length > 20) {
                        setSelectedTaskId(n.id);
                        setCmdTab("inspect");
                      }
                    }}
                    className="rounded-md border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-left"
                  >
                    <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
                      {n.label.replace(/_/g, " ")}
                    </p>
                    <p className="flex items-center gap-1 text-[10px]">
                      <Circle size={6} className={STATUS_DOT[n.status] ?? STATUS_DOT.idle} fill="currentColor" />
                      {n.status}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}

          {bottomTab === "terminal" && <IdeTerminalPanel worktreeId={selectedWorktreeId} />}

          {bottomTab === "patches" && <IdePatchReviewPanel worktreeId={selectedWorktreeId} />}

          {bottomTab === "worktrees" && (
            <IdeWorktreesPanel
              selectedId={selectedWorktreeId}
              onSelect={setSelectedWorktreeId}
              onInspectTask={(id) => {
                setSelectedTaskId(id);
                setCmdTab("inspect");
              }}
            />
          )}

          {bottomTab === "preview" && <IdeBrowserPreview />}

          {bottomTab === "models" && <IdeModelsPanel />}
        </div>
      </div>
    </div>
  );
}
