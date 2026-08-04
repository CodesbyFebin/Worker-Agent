import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Loader2,
  MessageSquare,
  PanelLeft,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useWorkspaceNav } from "../../components/WorkspaceNavContext";
import { ModelChooser } from "../../components/ModelChooser";
import type { AgentTaskStatus } from "../../../../shared/types";

type ChatMode = "ask" | "codex";

type LocalMsg =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "ask"; text: string }
  | { id: string; kind: "codex"; rootTaskId: string; goal: string }
  | { id: string; kind: "error"; text: string };

const STATUS_DOT: Record<string, string> = {
  pending: "bg-[var(--color-text-muted)]",
  assigned: "bg-[var(--color-violet)]",
  running: "bg-[var(--color-amber)] animate-pulse",
  awaiting_approval: "bg-[var(--color-violet)]",
  blocked: "bg-[var(--color-coral)]",
  completed: "bg-[var(--color-teal)]",
  failed: "bg-[var(--color-coral)]",
};

function goalFromRootTitle(title: string): string {
  return title.replace(/^Plan:\s*/i, "").trim() || title;
}

function shortId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Codex-style expandable agent step (tool call / subtask). */
function CodexStep({
  task,
  onRetry,
  retrying,
}: {
  task: {
    id: string;
    agentRole: string;
    title: string;
    status: string;
    errorMessage: string | null;
    result: unknown;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    worktree: { branchName: string; path: string } | null;
  };
  onRetry: () => void;
  retrying: boolean;
}) {
  const [open, setOpen] = useState(
    task.status === "running" || task.status === "failed" || task.status === "blocked",
  );
  const result = task.result as Record<string, unknown> | null;
  const reasoning = typeof result?.reasoning === "string" ? result.reasoning : null;
  const draft = typeof result?.draft === "string" ? result.draft : null;
  const summary = typeof result?.summary === "string" ? result.summary : null;
  const prUrl = typeof result?.prUrl === "string" ? result.prUrl : null;
  const preview = draft ?? summary;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface-raised)]"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status] ?? STATUS_DOT.pending}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-[var(--color-text-primary)]">{task.title}</p>
          <p className="font-[var(--font-display)] text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            {task.agentRole} · {task.status.replace(/_/g, " ")}
          </p>
        </div>
        {["pending", "blocked", "failed"].includes(task.status) && (
          <button
            type="button"
            disabled={retrying}
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {task.status === "pending" ? "Run" : "Retry"}
          </button>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-[var(--color-line)] px-3 py-3 text-[12px]">
          {task.errorMessage && <p className="text-[var(--color-coral)]">{task.errorMessage}</p>}
          {reasoning && <p className="italic text-[var(--color-text-muted)]">“{reasoning}”</p>}
          {preview && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--color-ink)] p-3 font-mono text-[11px] text-[var(--color-text-primary)]">
              {preview.slice(0, 4000)}
              {preview.length > 4000 ? "…" : ""}
            </pre>
          )}
          {task.worktree && (
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 font-mono text-[11px]">
              <p className="text-[var(--color-teal)]">{task.worktree.branchName}</p>
              <p className="truncate text-[var(--color-text-muted)]" title={task.worktree.path}>
                {task.worktree.path}
              </p>
            </div>
          )}
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-[var(--color-teal)] hover:underline"
            >
              Open pull request
            </a>
          )}
          {(task.inputTokens != null || task.outputTokens != null) && (
            <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
              {task.inputTokens ?? 0}→{task.outputTokens ?? 0} tok
              {task.costUsd != null && task.costUsd > 0 ? ` · $${task.costUsd.toFixed(4)}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CodexRunCard({ rootTaskId, goal }: { rootTaskId: string; goal: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, error } = trpc.godMachine.getTaskTree.useQuery(
    { rootTaskId },
    { refetchInterval: 2500 },
  );
  const runSubtask = trpc.godMachine.runSubtask.useMutation({
    onSuccess: () => utils.godMachine.getTaskTree.invalidate({ rootTaskId }),
  });
  const runPending = trpc.godMachine.runPendingChain.useMutation({
    onSuccess: () => utils.godMachine.getTaskTree.invalidate({ rootTaskId }),
  });

  const done =
    data &&
    data.subtasks.length > 0 &&
    data.subtasks.every((t) => ["completed", "failed", "blocked"].includes(t.status));
  const running = data?.subtasks.some((t) => t.status === "running" || t.status === "assigned");
  const pendingCount =
    data?.subtasks.filter((t) => ["pending", "blocked", "failed"].includes(t.status)).length ?? 0;

  return (
    <div className="w-full max-w-3xl space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-raised)] ring-1 ring-[var(--color-line)]">
          <Code2 size={15} className="text-[var(--color-amber)]" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Codex agent</p>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Planned and executing: <span className="text-[var(--color-text-primary)]">{goal}</span>
            </p>
          </div>

          {isLoading && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
              <Loader2 size={14} className="animate-spin" /> Loading agent steps…
            </p>
          )}
          {isError && <p className="text-[13px] text-[var(--color-coral)]">{error.message}</p>}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                {running ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-[var(--color-amber)]" />
                    Agents working…
                  </>
                ) : done ? (
                  <>
                    <Check size={12} className="text-[var(--color-teal)]" />
                    Run finished
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-[var(--color-teal)]" />
                    {data.subtasks.length} steps planned
                  </>
                )}
                {pendingCount > 0 && !running && (
                  <button
                    type="button"
                    disabled={runPending.isPending}
                    onClick={() => runPending.mutate({ rootTaskId })}
                    className="ml-auto rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] hover:border-[var(--color-violet)]/50"
                  >
                    {runPending.isPending ? "Running…" : `Run all (${pendingCount})`}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {data.subtasks.map((task) => (
                  <CodexStep
                    key={task.id}
                    task={{
                      ...task,
                      status: task.status as AgentTaskStatus,
                      worktree: task.worktree
                        ? { branchName: task.worktree.branchName, path: task.worktree.path }
                        : null,
                    }}
                    retrying={runSubtask.isPending}
                    onRetry={() => runSubtask.mutate({ taskId: task.id })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * God Machine — ChatGPT-style chat surface with Codex agent mode.
 * Ask = single LLM turn. Codex = real God Machine planner + BullMQ chain.
 */
export function GodMachineWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<ChatMode>("codex");
  const [modeMenu, setModeMenu] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();
  const { data: roots } = trpc.godMachine.listRootTasks.useQuery(undefined, { refetchInterval: 5000 });
  const godRoots = useMemo(
    () => (roots ?? []).filter((t) => !t.campaignId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [roots],
  );

  const chatMut = trpc.godMachine.chat.useMutation();
  const nav = useWorkspaceNav();
  const dispatchMut = trpc.godMachine.dispatchGoal.useMutation({
    onSuccess: (r) => {
      utils.godMachine.listRootTasks.invalidate();
      utils.pipeline.getActive.invalidate();
      utils.script.list.invalidate();
      if (r.scriptId) nav.setFocusScriptId(r.scriptId);
      if (r.pipelineId) nav.setFocusPipelineId(r.pipelineId);
    },
  });
  const runPendingMut = trpc.godMachine.runPendingChain.useMutation({
    onSuccess: (_d, vars) => {
      utils.godMachine.getTaskTree.invalidate({ rootTaskId: vars.rootTaskId });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  function newChat() {
    setMessages([]);
    setActiveRootId(null);
    setInput("");
    setBusy(false);
    textareaRef.current?.focus();
  }

  function openConversation(rootId: string, title: string) {
    const goal = goalFromRootTitle(title);
    setActiveRootId(rootId);
    setMode("codex");
    setMessages([
      { id: shortId(), kind: "user", text: goal },
      { id: shortId(), kind: "codex", rootTaskId: rootId, goal },
    ]);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    const userMsg: LocalMsg = { id: shortId(), kind: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // "run" / "go" / "continue" execute the active plan — do NOT re-plan as a new goal
      const isRunCmd = /^(run|go|continue|retry|execute)(\s+all)?[!?.]*$/i.test(text);
      if (mode === "codex" && isRunCmd && activeRootId) {
        const result = await runPendingMut.mutateAsync({ rootTaskId: activeRootId });
        setMessages((prev) => [
          ...prev,
          {
            id: shortId(),
            kind: "ask",
            text:
              result.ran > 0
                ? `Running ${result.ran} pending step(s) on the active plan.`
                : "No pending steps to run — chain may already be complete or still processing.",
          },
        ]);
        return;
      }

      if (mode === "ask") {
        const history = messages
          .filter((m): m is Extract<LocalMsg, { kind: "user" | "ask" }> => m.kind === "user" || m.kind === "ask")
          .map((m) => ({
            role: (m.kind === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          }));
        const { text: reply } = await chatMut.mutateAsync({ message: text, history });
        setMessages((prev) => [...prev, { id: shortId(), kind: "ask", text: reply }]);
      } else {
        const { rootTaskId, scriptId, pipelineId } = await dispatchMut.mutateAsync({ goal: text });
        setActiveRootId(rootTaskId);
        setMessages((prev) => [
          ...prev,
          { id: shortId(), kind: "codex", rootTaskId, goal: text },
          ...(scriptId
            ? [
                {
                  id: shortId(),
                  kind: "ask" as const,
                  text: `Script Studio linked (${scriptId.slice(0, 8)}…). When the writer finishes, the draft lands in Script Studio — use the pipeline bar Advance → Evidence → Research-to-Post → Workspace → Autopilot → Social → Approvals → Publishing.`,
                },
              ]
            : []),
        ]);
        if (scriptId) {
          nav.setFocusScriptId(scriptId);
          if (pipelineId) nav.setFocusPipelineId(pipelineId);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: shortId(), kind: "error", text: (err as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      {/* ChatGPT-style sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-[260px] opacity-100" : "w-0 opacity-0"
        } flex shrink-0 flex-col overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-surface)] transition-all duration-200`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={newChat}
            className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-raised)]"
          >
            <Plus size={16} />
            New chat
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            title="Close sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <p className="px-2 pb-2 pt-1 font-[var(--font-display)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Conversations
          </p>
          {godRoots.length === 0 && (
            <p className="px-2 text-[12px] text-[var(--color-text-muted)]">No agent runs yet</p>
          )}
          {godRoots.map((r) => {
            const label = goalFromRootTitle(r.title);
            const active = activeRootId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openConversation(r.id, r.title)}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                  active
                    ? "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <MessageSquare size={14} className="shrink-0 opacity-70" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main chat column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setModeMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
            >
              God Machine
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-[var(--color-text-muted)]">{mode === "codex" ? "Codex" : "Ask"}</span>
              <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
            </button>
            {modeMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setModeMenu(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("codex");
                      setModeMenu(false);
                    }}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[var(--color-surface-raised)]"
                  >
                    <Code2 size={16} className="mt-0.5 text-[var(--color-amber)]" />
                    <div>
                      <p className="text-[13px] font-medium">Codex agent</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Plan → multi-agent chain with worktrees & retries
                      </p>
                    </div>
                    {mode === "codex" && <Check size={14} className="ml-auto text-[var(--color-teal)]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("ask");
                      setModeMenu(false);
                    }}
                    className="flex w-full items-start gap-3 border-t border-[var(--color-line)] px-3 py-3 text-left hover:bg-[var(--color-surface-raised)]"
                  >
                    <Sparkles size={16} className="mt-0.5 text-[var(--color-teal)]" />
                    <div>
                      <p className="text-[13px] font-medium">Ask</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Single LLM reply — no agent dispatch
                      </p>
                    </div>
                    {mode === "ask" && <Check size={14} className="ml-auto text-[var(--color-teal)]" />}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="ml-auto">
            <ModelChooser />
          </div>
        </header>

        {/* Messages / empty state */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center px-4 pb-24">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]">
                <Sparkles size={26} className="text-[var(--color-teal)]" />
              </div>
              <h2 className="text-vibe-brand text-center text-3xl tracking-tight sm:text-4xl">
                What can I help with?
              </h2>
              <p className="mt-2 max-w-md text-center text-[14px] text-[var(--color-text-muted)]">
                ChatGPT-style Ask mode, or Codex agent mode that plans and runs real God Machine
                subtasks.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {[
                  { mode: "codex" as const, label: "Ship a feature", hint: "Codex · plan + code agents" },
                  { mode: "codex" as const, label: "Write a YouTube Short script", hint: "Codex · content pipeline" },
                  { mode: "ask" as const, label: "Explain this architecture", hint: "Ask · single reply" },
                  { mode: "ask" as const, label: "Draft a PR description", hint: "Ask · single reply" },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setMode(s.mode);
                      setInput(s.label);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left transition hover:bg-[var(--color-surface-raised)]"
                  >
                    <p className="text-[13px] text-[var(--color-text-primary)]">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{s.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              {messages.map((m) => {
                if (m.kind === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-3xl bg-[var(--color-surface-raised)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--color-text-primary)]">
                        {m.text}
                      </div>
                    </div>
                  );
                }
                if (m.kind === "ask") {
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-raised)] ring-1 ring-[var(--color-line)]">
                        <Sparkles size={14} className="text-[var(--color-teal)]" />
                      </div>
                      <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-text-primary)]">
                        {m.text}
                      </div>
                    </div>
                  );
                }
                if (m.kind === "codex") {
                  return <CodexRunCard key={m.id} rootTaskId={m.rootTaskId} goal={m.goal} />;
                }
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-2 rounded-xl border border-[var(--color-coral)]/40 bg-[var(--color-coral)]/10 px-3 py-2 text-[13px] text-[var(--color-coral)]"
                  >
                    <X size={14} className="mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </div>
                );
              })}
              {busy && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                  <Loader2 size={14} className="animate-spin text-[var(--color-amber)]" />
                  {mode === "codex" ? "Planning with God Machine…" : "Thinking…"}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer — ChatGPT-style */}
        <div className="shrink-0 px-3 pb-4 pt-1">
          <form
            onSubmit={submit}
            className="mx-auto w-full max-w-3xl rounded-[28px] border border-[var(--color-teal)]/35 bg-[var(--color-surface)]/95 shadow-[var(--glow-cyan)] focus-within:border-[var(--color-teal)]/70"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                mode === "codex"
                  ? "Message God Machine Codex — describe a goal to plan & execute…"
                  : "Message God Machine Ask…"
              }
              className="max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-5 pb-2 pt-4 text-[15px] leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode(mode === "codex" ? "ask" : "codex")}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  {mode === "codex" ? <Code2 size={13} /> : <Sparkles size={13} />}
                  {mode === "codex" ? "Codex" : "Ask"}
                </button>
                {activeRootId && (
                  <button
                    type="button"
                    onClick={() => utils.godMachine.getTaskTree.invalidate({ rootTaskId: activeRootId })}
                    className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
                    title="Refresh agent tree"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={busy || input.trim().length === 0}
                className="btn-vibe-primary flex h-9 w-9 items-center justify-center disabled:transform-none"
                aria-label="Send"
              >
                {busy ? <Square size={12} fill="currentColor" /> : <ArrowUp size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[var(--color-text-muted)]">
            God Machine can make mistakes. Codex runs real agents against your repo & APIs — review
            before publishing.
          </p>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer GodMachineWorkspace — kept for any direct imports. */
export { GoalDispatcher, TaskTreeVisualizer } from "./TaskTreeVisualizer";
