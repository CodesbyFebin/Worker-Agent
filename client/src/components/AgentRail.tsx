import { trpc } from "../lib/trpc";

const ROLE_LABEL: Record<string, string> = {
  planner: "Planner",
  researcher: "Researcher",
  writer: "Writer",
  reviewer: "Reviewer",
  coder: "Coder",
  qa: "QA",
  publisher: "Publisher",
  video_generator: "Video",
  video_editor: "Editor",
  voiceover: "Voiceover",
  caption_hashtag: "Captions",
  seo: "SEO",
};

/**
 * Persistent strip of agents that are actually alive right now.
 */
export function AgentRail() {
  const { data: active } = trpc.godMachine.listActive.useQuery(undefined, { refetchInterval: 3000 });

  return (
    <aside className="hidden w-56 shrink-0 border-l border-[var(--color-line)] bg-[var(--color-surface)]/90 p-4 backdrop-blur-md lg:block">
      <p className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        Agents active
      </p>

      <div className="mt-3 space-y-2">
        {!active || active.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">Nothing running right now.</p>
        ) : (
          active.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-[var(--color-amber)]/30 bg-[var(--color-surface-raised)] p-2 shadow-[var(--glow-lime)]"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--color-amber)] shadow-[var(--glow-lime)]" />
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-[var(--color-amber)]">
                  {ROLE_LABEL[task.agentRole] ?? task.agentRole}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-[var(--color-text-primary)]" title={task.title}>
                {task.title}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
