import { trpc } from "../../lib/trpc";

export function IdeAgentInspector({ taskId }: { taskId: string | null }) {
  const detail = trpc.ide.getTask.useQuery(
    { taskId: taskId! },
    { enabled: Boolean(taskId), refetchInterval: 3000 },
  );

  if (!taskId) {
    return (
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Select a task from Plan, Memory, swarm, or a worktree to inspect real events / result /
        worktree.
      </p>
    );
  }

  if (detail.isLoading) return <p className="text-[12px] text-[var(--color-text-muted)]">Loading…</p>;
  if (detail.isError) return <p className="text-[12px] text-[var(--color-coral)]">{detail.error.message}</p>;
  if (!detail.data) return null;

  const { task, events, worktree, inspection } = detail.data;

  return (
    <div className="space-y-3 text-[12px]">
      <div>
        <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
          Task
        </p>
        <p className="text-[var(--color-text-primary)]">{task.title}</p>
        <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
          {task.agentRole} · {task.status} · {task.id.slice(0, 8)}…
        </p>
        {(task.inputTokens != null || task.outputTokens != null) && (
          <p className="text-[10px] text-[var(--color-text-muted)]">
            tokens in/out {task.inputTokens ?? 0}/{task.outputTokens ?? 0}
            {task.costUsd != null ? ` · $${task.costUsd}` : ""}
          </p>
        )}
      </div>

      {worktree && (
        <div className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
          <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
            Worktree
          </p>
          <p className="font-[var(--font-mono)] text-[11px] text-[var(--color-teal)]">{worktree.branchName}</p>
          <p className="truncate text-[10px] text-[var(--color-text-muted)]">{worktree.path}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {worktree.isLocked ? "locked" : "unlocked"}
            {worktree.removedAt ? ` · removed ${worktree.removedAt}` : ""}
          </p>
        </div>
      )}

      <div className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
        <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
          Inspection
        </p>
        {inspection.reasoning ? (
          <p className="mt-1 italic text-[var(--color-text-muted)]">{inspection.reasoning}</p>
        ) : (
          <p className="mt-1 text-[var(--color-text-muted)]">No reasoning field on result</p>
        )}
        {inspection.approved != null && (
          <p className="mt-1">approved={String(inspection.approved)}</p>
        )}
        {inspection.issues && inspection.issues.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-[var(--color-amber)]">
            {inspection.issues.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        )}
        {inspection.prUrl && (
          <a
            href={inspection.prUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-[var(--color-teal)] underline"
          >
            {inspection.prUrl}
          </a>
        )}
        {inspection.draftPreview && (
          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[10px] text-[var(--color-text-muted)]">
            {inspection.draftPreview}
          </pre>
        )}
      </div>

      <div>
        <p className="font-[var(--font-display)] text-[10px] uppercase text-[var(--color-text-muted)]">
          Events
        </p>
        <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="border-b border-[var(--color-line)]/50 py-0.5 text-[10px]">
              <span className="text-[var(--color-teal)]">{e.eventType}</span>{" "}
              <span className="text-[var(--color-text-muted)]">{e.message}</span>
            </li>
          ))}
          {events.length === 0 && (
            <li className="text-[var(--color-text-muted)]">No events yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}
