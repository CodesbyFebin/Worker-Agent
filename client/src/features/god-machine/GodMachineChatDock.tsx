import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, Code2, Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { ModelChooser } from "../../components/ModelChooser";
import { useWorkspaceNav } from "../../components/WorkspaceNavContext";

type ChatMode = "ask" | "codex";

type LocalMsg =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "ask"; text: string }
  | { id: string; kind: "codex"; rootTaskId: string; goal: string }
  | { id: string; kind: "error"; text: string };

function shortId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Compact God Machine Ask/Codex panel for embedding on Autopilot / YouTube pages.
 */
export function GodMachineChatDock({
  contextHint,
  onClose,
}: {
  contextHint?: string;
  onClose?: () => void;
}) {
  const [mode, setMode] = useState<ChatMode>("codex");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const nav = useWorkspaceNav();

  const chatMut = trpc.godMachine.chat.useMutation();
  const dispatchMut = trpc.godMachine.dispatchGoal.useMutation({
    onSuccess: (r) => {
      utils.godMachine.listRootTasks.invalidate();
      utils.pipeline.getActive.invalidate();
      utils.script.list.invalidate();
      if (r.scriptId) nav.setFocusScriptId(r.scriptId);
      if (r.pipelineId) nav.setFocusPipelineId(r.pipelineId);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { id: shortId(), kind: "user", text }]);
    try {
      if (mode === "ask") {
        const history = messages
          .filter((m): m is Extract<LocalMsg, { kind: "user" | "ask" }> => m.kind === "user" || m.kind === "ask")
          .map((m) => ({
            role: (m.kind === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          }));
        const prompt = contextHint
          ? `[Autopilot context]\n${contextHint}\n\nUser: ${text}`
          : text;
        const { text: reply } = await chatMut.mutateAsync({ message: prompt, history });
        setMessages((prev) => [...prev, { id: shortId(), kind: "ask", text: reply }]);
      } else {
        const goal = contextHint ? `${text}\n\n(Context: ${contextHint})` : text;
        const { rootTaskId, scriptId } = await dispatchMut.mutateAsync({ goal });
        setMessages((prev) => [
          ...prev,
          { id: shortId(), kind: "codex", rootTaskId, goal: text },
          ...(scriptId
            ? [
                {
                  id: shortId(),
                  kind: "ask" as const,
                  text: "Draft will land in Script Studio. Use pipeline Advance → through Evidence → … → Publishing.",
                },
              ]
            : []),
        ]);
        if (scriptId) nav.setFocusScriptId(scriptId);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: shortId(), kind: "error", text: (err as Error).message }]);
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

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
        <Sparkles size={14} className="text-[var(--color-teal)]" />
        <p className="text-[13px] font-semibold">God Machine</p>
        <div className="flex rounded-lg border border-[var(--color-line)] text-[11px]">
          <button
            type="button"
            onClick={() => setMode("codex")}
            className={`flex items-center gap-1 px-2 py-1 ${mode === "codex" ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)]" : "text-[var(--color-text-muted)]"}`}
          >
            <Code2 size={11} /> Codex
          </button>
          <button
            type="button"
            onClick={() => setMode("ask")}
            className={`flex items-center gap-1 px-2 py-1 ${mode === "ask" ? "bg-[var(--color-teal)]/20 text-[var(--color-teal)]" : "text-[var(--color-text-muted)]"}`}
          >
            <MessageSquare size={11} /> Ask
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ModelChooser compact />
          {onClose && (
            <button type="button" onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-ink)]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-[13px]">
        {messages.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Ask about this Autopilot run, or Codex a goal (script, research, publish fix). Uses the live LLM
            selection.
          </p>
        )}
        {messages.map((m) => {
          if (m.kind === "user") {
            return (
              <div key={m.id} className="ml-6 rounded-2xl bg-[var(--color-ink)] px-3 py-2">
                {m.text}
              </div>
            );
          }
          if (m.kind === "ask") {
            return (
              <div key={m.id} className="mr-4 whitespace-pre-wrap rounded-2xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2">
                {m.text}
              </div>
            );
          }
          if (m.kind === "codex") {
            return <CodexMini key={m.id} rootTaskId={m.rootTaskId} goal={m.goal} />;
          }
          return (
            <p key={m.id} className="text-[var(--color-coral)]">
              {m.text}
            </p>
          );
        })}
        {busy && (
          <p className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            <Loader2 size={12} className="animate-spin" /> Working…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-[var(--color-line)] p-2">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={mode === "codex" ? "Codex goal for this video pipeline…" : "Ask about Autopilot…"}
            className="min-h-[44px] flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-violet)] text-white disabled:opacity-40"
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

function CodexMini({ rootTaskId, goal }: { rootTaskId: string; goal: string }) {
  const { data, isLoading } = trpc.godMachine.getTaskTree.useQuery(
    { rootTaskId },
    { refetchInterval: 2500 },
  );
  const runSubtask = trpc.godMachine.runSubtask.useMutation();

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
      <p className="text-[11px] text-[var(--color-text-muted)]">Codex · {goal.slice(0, 80)}</p>
      {isLoading && <Loader2 size={12} className="mt-1 animate-spin text-[var(--color-amber)]" />}
      <ul className="mt-1 space-y-1">
        {(data?.subtasks ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                t.status === "completed"
                  ? "bg-[var(--color-teal)]"
                  : t.status === "failed" || t.status === "blocked"
                    ? "bg-[var(--color-coral)]"
                    : t.status === "running"
                      ? "animate-pulse bg-[var(--color-amber)]"
                      : "bg-[var(--color-text-muted)]"
              }`}
            />
            <span className="min-w-0 flex-1 truncate">
              {t.agentRole}: {t.title}
            </span>
            {["pending", "failed", "blocked"].includes(t.status) && (
              <button
                type="button"
                className="text-[var(--color-violet)]"
                onClick={() => runSubtask.mutate({ taskId: t.id })}
              >
                Run
              </button>
            )}
            {t.status === "completed" && <Check size={10} className="text-[var(--color-teal)]" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
