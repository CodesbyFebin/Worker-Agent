import { useState } from "react";
import { trpc } from "../../lib/trpc";

export function IdeTerminalPanel({ worktreeId }: { worktreeId?: string | null }) {
  const { data: commands } = trpc.ide.listCommands.useQuery();
  const [log, setLog] = useState<string>("$ Select an allowlisted command — arbitrary shell is disabled.\n");
  const [selected, setSelected] = useState("test");

  const run = trpc.ide.runCommand.useMutation({
    onSuccess: (r) => {
      setLog(
        (prev) =>
          prev +
          `\n$ ${r.argv.join(" ")}\n` +
          `(cwd=${r.cwd} · exit=${r.exitCode} · ${r.durationMs}ms)\n` +
          (r.stdout || "") +
          (r.stderr ? `\n[stderr]\n${r.stderr}` : "") +
          "\n",
      );
    },
    onError: (e) => {
      setLog((prev) => prev + `\n! ${e.message}\n`);
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[11px]"
        >
          {(commands ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={run.isPending}
          onClick={() =>
            run.mutate({
              commandId: selected,
              worktreeId: worktreeId ?? undefined,
            })
          }
          className="rounded bg-[var(--color-teal)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink)] disabled:opacity-40"
        >
          {run.isPending ? "Running…" : "Run"}
        </button>
        <button
          type="button"
          onClick={() => setLog("")}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px]"
        >
          Clear
        </button>
        {worktreeId && (
          <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-amber)]">
            cwd=worktree
          </span>
        )}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-[var(--font-mono)] text-[11px] leading-5 text-[var(--color-teal)]">
        {log}
      </pre>
    </div>
  );
}
