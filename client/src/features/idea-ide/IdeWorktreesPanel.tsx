import { trpc } from "../../lib/trpc";

export function IdeWorktreesPanel({
  selectedId,
  onSelect,
  onInspectTask,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onInspectTask: (taskId: string) => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.ide.listWorktrees.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const remove = trpc.ide.removeWorktree.useMutation({
    onSuccess: () => void utils.ide.listWorktrees.invalidate(),
  });

  if (isLoading) return <p className="text-[12px] text-[var(--color-text-muted)]">Loading worktrees…</p>;
  if (error) return <p className="text-[12px] text-[var(--color-coral)]">{error.message}</p>;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Active git worktrees from `agent_worktrees` (paths under `.worktrees/`). Branches are kept after
        remove for review.
      </p>
      {(data ?? []).length === 0 && (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          No active worktrees. Dispatch a God Machine / coder task to create one.
        </p>
      )}
      <ul className="space-y-2">
        {(data ?? []).map((wt) => (
          <li
            key={wt.id}
            className={`rounded border px-2 py-1.5 text-[11px] ${
              selectedId === wt.id
                ? "border-[var(--color-teal)] bg-[var(--color-teal)]/10"
                : "border-[var(--color-line)] bg-[var(--color-ink)]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button type="button" className="min-w-0 text-left" onClick={() => onSelect(wt.id)}>
                <p className="font-[var(--font-mono)] text-[var(--color-teal)]">{wt.branchName}</p>
                <p className="truncate text-[var(--color-text-muted)]">{wt.path}</p>
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  {wt.agentDepartment} · {wt.isLocked ? "locked" : "unlocked"} ·{" "}
                  {wt.existsOnDisk ? "on disk" : "missing"}
                </p>
              </button>
              <div className="flex shrink-0 flex-col gap-1">
                {wt.task && (
                  <button
                    type="button"
                    className="text-[10px] text-[var(--color-violet)]"
                    onClick={() => onInspectTask(wt.task!.id)}
                  >
                    Inspect task
                  </button>
                )}
                <button
                  type="button"
                  disabled={remove.isPending}
                  className="text-[10px] text-[var(--color-amber)]"
                  onClick={() => {
                    if (confirm(`Remove worktree ${wt.branchName}? Branch is kept.`)) {
                      remove.mutate({ worktreeId: wt.id });
                      if (selectedId === wt.id) onSelect(null);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
