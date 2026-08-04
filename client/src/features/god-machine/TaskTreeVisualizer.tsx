import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { AgentTaskStatus } from "../../../../shared/types";

const STATUS_STYLES: Record<AgentTaskStatus, string> = {
  pending: "text-[var(--color-text-muted)] border-[var(--color-line)]",
  assigned: "text-[var(--color-violet)]/70 border-[var(--color-violet)]/70",
  running: "text-[var(--color-amber)] border-[var(--color-amber)] animate-pulse",
  awaiting_approval: "text-[var(--color-violet)] border-[var(--color-violet)]",
  blocked: "text-[var(--color-coral)]/70 border-[var(--color-coral)]/70",
  completed: "text-[var(--color-teal)] border-[var(--color-teal)]",
  failed: "text-[var(--color-coral)] border-[var(--color-coral)]",
};

export function GoalDispatcher({ onDispatched }: { onDispatched: (rootTaskId: string) => void }) {
  const [goal, setGoal] = useState("");
  const dispatch = trpc.godMachine.dispatchGoal.useMutation({
    onSuccess: (result) => onDispatched(result.rootTaskId),
  });

  return (
    <div className="flex gap-2">
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="e.g. Write a 60-second YouTube Short about our new auto-publishing feature"
        className="flex-1 rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
      />
      <button
        type="button"
        disabled={dispatch.isPending || goal.trim().length === 0}
        onClick={() => dispatch.mutate({ goal: goal.trim() })}
        className="shrink-0 rounded bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
      >
        {dispatch.isPending ? "Planning…" : "Dispatch to God Machine"}
      </button>
    </div>
  );
}

export function TaskTreeVisualizer({ rootTaskId }: { rootTaskId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, error } = trpc.godMachine.getTaskTree.useQuery(
    { rootTaskId },
    { refetchInterval: 3000 }, // cheap polling stand-in until a real event stream exists
  );

  const runSubtask = trpc.godMachine.runSubtask.useMutation({
    onSuccess: () => utils.godMachine.getTaskTree.invalidate({ rootTaskId }),
  });

  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading task tree…</p>;
  if (isError) return <p className="text-sm text-[var(--color-coral)]">Couldn't load task tree: {error.message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3">
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">planner</span>
        <p className="mt-1 text-sm text-[var(--color-text-primary)]">{data.root.title}</p>
      </div>

      <div className="space-y-2 pl-4">
        {data.subtasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
          >
            <div>
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{task.agentRole}</span>
              <p className="text-sm text-[var(--color-text-primary)]">{task.title}</p>
              {task.errorMessage && <p className="mt-1 text-xs text-[var(--color-coral)]">{task.errorMessage}</p>}
              {typeof (task.result as { reasoning?: string } | null)?.reasoning === "string" && (
                <p className="mt-1 text-xs italic text-[var(--color-text-muted)]">
                  “{(task.result as { reasoning: string }).reasoning}”
                </p>
              )}
              {(task.inputTokens != null || task.outputTokens != null) && (
                <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                  {task.inputTokens ?? 0}→{task.outputTokens ?? 0} tok
                  {task.costUsd != null && task.costUsd > 0 ? ` · $${task.costUsd.toFixed(4)}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLES[task.status as AgentTaskStatus]}`}>
                {task.status}
              </span>
              {["pending", "blocked", "failed"].includes(task.status) && (
                <button
                  type="button"
                  disabled={runSubtask.isPending}
                  onClick={() => runSubtask.mutate({ taskId: task.id })}
                  className="rounded border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  {task.status === "pending" ? "Run" : "Retry"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
