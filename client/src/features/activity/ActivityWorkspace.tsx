import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

export function ActivityWorkspace() {
  const { data: events, isLoading } = trpc.ide.listRecentEvents.useQuery({ limit: 60 }, { refetchInterval: 4000 });
  const { data: active } = trpc.godMachine.listActive.useQuery(undefined, { refetchInterval: 4000 });
  const { data: roots } = trpc.godMachine.listRootTasks.useQuery(undefined, { refetchInterval: 8000 });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="Activity" status="Live event stream" statusTone="teal" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Agent events
            </p>
            {isLoading && <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">Loading…</p>}
            <ul className="mt-2 space-y-2">
              {(events ?? []).map((e) => (
                <li key={e.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-violet)]">{e.eventType}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5">{e.message}</p>
                </li>
              ))}
              {!events?.length && !isLoading && (
                <li className="text-[12px] text-[var(--color-text-muted)]">No events yet</li>
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Live + recent roots
            </p>
            <ul className="mt-2 space-y-2">
              {(active ?? []).map((t) => (
                <li key={t.id} className="rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-ink)] px-3 py-2 text-[12px]">
                  <span className="text-[var(--color-amber)]">{t.agentRole}</span> · {t.title}
                </li>
              ))}
              {(roots ?? []).slice(0, 15).map((t) => (
                <li key={t.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]">
                  {t.title} · {t.status}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function InboxWorkspace() {
  const { data: events } = trpc.ide.listRecentEvents.useQuery({ limit: 40 }, { refetchInterval: 5000 });
  const { data: awaiting } = trpc.ide.listAwaitingApproval.useQuery();
  const [tab, setTab] = useState<"all" | "comments" | "messages" | "mentions" | "flagged">("all");

  const items = [
    ...(awaiting ?? []).map((t) => ({
      id: t.id,
      kind: "approval" as const,
      title: t.title,
      meta: t.agentRole,
      at: t.updatedAt,
    })),
    ...(events ?? []).map((e) => ({
      id: e.id,
      kind: "event" as const,
      title: e.message,
      meta: e.eventType,
      at: e.createdAt,
    })),
  ].filter((i) => (tab === "flagged" ? i.kind === "approval" : true));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="Inbox" status="Agent + approval messages" statusTone="violet" />
      <div className="flex gap-1 border-b border-[var(--color-line)] px-3 py-2">
        {(["all", "comments", "messages", "mentions", "flagged"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-[11px] capitalize ${
              tab === t ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.map((i) => (
          <li
            key={i.id}
            className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[12px]"
          >
            <div className="min-w-0">
              <p className="truncate">{i.title}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {i.meta} · {new Date(i.at).toLocaleString()}
              </p>
            </div>
            {i.kind === "approval" && (
              <span className="shrink-0 text-[10px] uppercase text-[var(--color-violet)]">Needs review</span>
            )}
          </li>
        ))}
        {!items.length && (
          <li className="text-[13px] text-[var(--color-text-muted)]">
            No social DMs — inbox shows agent events & approval tasks (honest).
          </li>
        )}
      </ul>
    </div>
  );
}
