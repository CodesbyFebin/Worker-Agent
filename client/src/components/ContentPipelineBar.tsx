import { ChevronRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useWorkspaceNav } from "./WorkspaceNavContext";
import type { WorkspaceId } from "./AppShell";

/**
 * Persistent Content Ops handoff rail:
 * God Machine → Script Studio → Evidence → Research-to-Post → Workspace →
 * YouTube Autopilot → Social → Approvals → Publishing
 */
export function ContentPipelineBar() {
  const nav = useWorkspaceNav();
  const utils = trpc.useUtils();
  const { data: active } = trpc.pipeline.getActive.useQuery(undefined, { refetchInterval: 4000 });
  const advance = trpc.pipeline.advance.useMutation({
    onSuccess: (r) => {
      utils.pipeline.getActive.invalidate();
      utils.pipeline.list.invalidate();
      utils.script.list.invalidate();
      utils.ledger.listRecent.invalidate();
      utils.campaign.list.invalidate();
      if (r.scriptId) nav.setFocusScriptId(r.scriptId);
      if (r.id) nav.setFocusPipelineId(r.id);
      if (r.workspaceId) nav.setActive(r.workspaceId as WorkspaceId);
    },
  });

  if (!active || active.stage === "done") return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 px-3 py-2 backdrop-blur-md">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        Content pipeline
      </p>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-x-auto">
        {active.stages.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              title={s.label}
              onClick={() => {
                nav.setFocusScriptId(active.scriptId);
                nav.setFocusPipelineId(active.id);
                nav.setActive(s.workspaceId as WorkspaceId);
              }}
              className={`rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap ${
                s.current
                  ? "bg-[var(--color-violet)] text-white shadow-[var(--glow-magenta)]"
                  : s.done
                    ? "bg-[var(--color-teal)]/20 text-[var(--color-teal)]"
                    : "border border-[var(--color-line)] text-[var(--color-text-muted)]"
              }`}
            >
              {s.label}
            </button>
            {i < active.stages.length - 1 && (
              <ChevronRight size={10} className="shrink-0 text-[var(--color-text-muted)]" />
            )}
          </div>
        ))}
      </div>
      <p className="hidden max-w-[180px] truncate text-[11px] text-[var(--color-text-muted)] sm:block" title={active.title}>
        {active.title}
      </p>
      <button
        type="button"
        disabled={advance.isPending || active.stage === "done"}
        onClick={() => advance.mutate({ pipelineId: active.id })}
        className="rounded-lg bg-[var(--color-violet)] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
      >
        {advance.isPending ? "Advancing…" : active.stage === "publishing" ? "Mark done" : `Advance →`}
      </button>
    </div>
  );
}
