import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

export function OverviewWorkspace() {
  const { data: campaigns } = trpc.campaign.list.useQuery(undefined, { refetchInterval: 8000 });
  const { data: active } = trpc.godMachine.listActive.useQuery(undefined, { refetchInterval: 4000 });
  const { data: summary } = trpc.ledger.summary.useQuery(undefined, { refetchInterval: 10000 });
  const { data: scripts } = trpc.script.list.useQuery();
  const { data: awaiting } = trpc.ide.listAwaitingApproval.useQuery(undefined, { refetchInterval: 5000 });
  const { data: cost } = trpc.ide.costSummary.useQuery(undefined, { refetchInterval: 10000 });
  const { data: events } = trpc.ide.listRecentEvents.useQuery({ limit: 12 });
  const { data: recentClaims } = trpc.ledger.listRecent.useQuery({ limit: 8 });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="ContentOps Agent" status="Review required" statusTone="amber" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Research active" value={String(active?.length ?? 0)} hint="Agents running/assigned" tone="var(--color-violet)" />
          <Card label="Drafts in review" value={String(scripts?.length ?? 0)} hint="Scripts in studio" tone="#3b82f6" />
          <Card label="Claims need attention" value={String(summary?.byStatus.pending ?? 0)} tone="var(--color-amber)" />
          <Card label="Publishing ready" value={String(awaiting?.length ?? 0)} hint="awaiting_approval" tone="var(--color-teal)" />
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-7">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Claim evidence engine
            </p>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
              {(recentClaims ?? []).map((c) => (
                <li key={c.id} className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-2 text-[12px]">
                  <span className="truncate">{c.claimText}</span>
                  <span className="text-[var(--color-text-muted)]">{c.sourceUrl ? "1+ src" : "0"}</span>
                  <span
                    className={
                      c.verificationStatus === "verified"
                        ? "text-[var(--color-teal)]"
                        : c.verificationStatus === "rejected"
                          ? "text-[var(--color-coral)]"
                          : "text-[var(--color-amber)]"
                    }
                  >
                    {c.verificationStatus}
                  </span>
                </li>
              ))}
              {!recentClaims?.length && (
                <li className="text-[12px] text-[var(--color-text-muted)]">No claims yet</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-5">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Human approval queue
            </p>
            <ul className="mt-2 space-y-2">
              {(awaiting ?? []).slice(0, 6).map((t) => (
                <li key={t.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-2 text-[12px]">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-[10px] text-[var(--color-violet)]">{t.agentRole}</p>
                </li>
              ))}
              {!awaiting?.length && (
                <li className="text-[12px] text-[var(--color-text-muted)]">Queue empty</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-8">
            <p className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Content pipeline
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "Research", n: active?.filter((a) => a.agentRole === "researcher").length ?? 0, c: "var(--color-violet)" },
                { label: "Draft", n: scripts?.length ?? 0, c: "#3b82f6" },
                { label: "Verify", n: summary?.byStatus.pending ?? 0, c: "var(--color-amber)" },
                { label: "Approved", n: summary?.byStatus.verified ?? 0, c: "var(--color-teal)" },
                { label: "Scheduled", n: awaiting?.length ?? 0, c: "var(--color-teal)" },
              ].map((col) => (
                <div key={col.label} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
                  <p className="text-[11px] font-medium" style={{ color: col.c }}>
                    {col.label}
                  </p>
                  <p className="font-[var(--font-display)] text-xl">{col.n}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(campaigns ?? []).slice(0, 4).map((c) => (
                <div key={c.id} className="rounded-lg border border-[var(--color-line)] px-2 py-1.5 text-[12px]">
                  <p className="truncate">{c.topic}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{c.status}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-4">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Performance learning
            </p>
            <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
              Cost rollup (real): ${Number(cost?.costUsd ?? 0).toFixed(4)} · {cost?.completed ?? 0} completed ·{" "}
              {cost?.failed ?? 0} failed
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px]">
              {["Learn", "Research", "Draft", "Verify", "Publish"].map((n, i) => (
                <span key={n} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[var(--color-violet)]">→</span>}
                  <span className="rounded-full border border-[var(--color-violet)]/40 px-2 py-1 text-[var(--color-violet)]">
                    {n}
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
          <span className="text-[11px] text-[var(--color-text-muted)]">Create content for</span>
          {["Professional Post", "Forum", "Blog", "Newsletter", "Video Script"].map((x) => (
            <span key={x} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[11px]">
              {x}
            </span>
          ))}
        </div>
      </div>

      <footer className="flex flex-wrap gap-3 border-t border-[var(--color-line)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        {(events ?? []).slice(0, 5).map((e) => (
          <span key={e.id}>
            {e.message.slice(0, 48)} · {new Date(e.createdAt).toLocaleTimeString()}
          </span>
        ))}
      </footer>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="font-[var(--font-display)] text-2xl" style={{ color: tone }}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
