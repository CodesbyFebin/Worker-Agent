import { useState } from "react";
import { trpc } from "../../lib/trpc";

export function IdePatchReviewPanel({ worktreeId }: { worktreeId?: string | null }) {
  const status = trpc.ide.repoStatus.useQuery(undefined, { refetchInterval: 8000 });
  const diff = trpc.ide.getDiff.useQuery(
    { worktreeId: worktreeId ?? undefined },
    { refetchInterval: 8000 },
  );
  const [title, setTitle] = useState("IDEa prepared change");
  const [draft, setDraft] = useState<string | null>(null);
  const [prMsg, setPrMsg] = useState<string | null>(null);

  const prepare = trpc.ide.preparePr.useMutation({
    onSuccess: (r) => {
      setDraft(r.draftBody);
      setPrMsg(
        r.opened && r.prUrl
          ? `Opened ${r.prUrl}`
          : r.reason ?? (r.prUrl ? r.prUrl : "Draft prepared (not opened)"),
      );
    },
    onError: (e) => setPrMsg(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">
          {status.data?.branch ?? "…"}
          {status.data?.dirty ? " · dirty" : " · clean"}
          {worktreeId ? " · worktree" : " · main checkout"}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-[12rem] flex-1 rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[11px]"
          placeholder="PR title"
        />
        <button
          type="button"
          disabled={prepare.isPending}
          onClick={() =>
            prepare.mutate({
              title,
              worktreeId: worktreeId ?? undefined,
              open: false,
            })
          }
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px]"
        >
          Draft PR body
        </button>
        <button
          type="button"
          disabled={prepare.isPending}
          onClick={() =>
            prepare.mutate({
              title,
              worktreeId: worktreeId ?? undefined,
              open: true,
            })
          }
          className="rounded bg-[var(--color-violet)] px-2 py-1 text-[10px] text-white disabled:opacity-40"
        >
          Open PR
        </button>
      </div>
      {prMsg && <p className="text-[11px] text-[var(--color-text-muted)]">{prMsg}</p>}
      {draft && (
        <pre className="max-h-24 overflow-auto rounded border border-[var(--color-line)] bg-[var(--color-ink)] p-2 text-[10px] text-[var(--color-text-muted)]">
          {draft}
        </pre>
      )}
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-[var(--font-mono)] text-[10px] leading-4 text-[#9ecbff]">
        {diff.isLoading && "Loading diff…"}
        {diff.isError && diff.error.message}
        {diff.data && (diff.data.diff || "(no diff)")}
        {diff.data?.truncated && "\n…truncated"}
      </pre>
    </div>
  );
}
