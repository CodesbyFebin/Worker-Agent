import { useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

export function SocialManagerWorkspace() {
  const { data: connectors } = trpc.connectors.list.useQuery();
  const { data: awaiting } = trpc.ide.listAwaitingApproval.useQuery(undefined, { refetchInterval: 5000 });
  const { data: summary } = trpc.ledger.summary.useQuery();
  const { data: campaigns } = trpc.campaign.list.useQuery();
  const { data: events } = trpc.ide.listRecentEvents.useQuery({ limit: 20 });

  const pubs = (connectors?.connectors ?? []).filter((c) => c.category === "publishing");
  const [channel, setChannel] = useState("youtube");
  const [caption, setCaption] = useState("");
  const [voice, setVoice] = useState<"Clear" | "Expert" | "Conversational">("Clear");
  const [msg, setMsg] = useState<string | null>(null);

  const extract = trpc.ledger.extractAndLog.useMutation({
    onSuccess: () => setMsg("Claims extracted — open Evidence to verify"),
    onError: (e) => setMsg(e.message),
  });
  const { data: scripts } = trpc.script.list.useQuery();

  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    return days;
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Social Manager"
        status="Always-On Social"
        statusTone="violet"
        actions={
          <>
            <button
              type="button"
              className="rounded-full bg-[var(--color-violet)] px-3 py-1.5 text-[12px] font-semibold text-white"
              onClick={() => setMsg("Use composer below → Send for approval routes via claim check + Approvals queue")}
            >
              Create post
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
              onClick={() => setMsg(`${awaiting?.length ?? 0} items awaiting approval`)}
            >
              Review queue
            </button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {msg && (
          <p className="mb-2 text-[12px] text-[var(--color-teal)]">
            {msg}{" "}
            <button type="button" onClick={() => setMsg(null)} className="text-[var(--color-text-muted)]">
              dismiss
            </button>
          </p>
        )}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card tone="var(--color-violet)" label="Drafts in progress" value={String(campaigns?.filter((c) => c.status === "active" || c.status === "planning").length ?? 0)} />
          <Card tone="var(--color-amber)" label="Claims need review" value={String(summary?.byStatus.pending ?? 0)} />
          <Card tone="var(--color-teal)" label="Approved to schedule" value={String(awaiting?.length ?? 0)} hint="awaiting_approval tasks" />
          <Card tone="var(--color-coral)" label="Replies need attention" value="0" hint="Inbox replies not wired — no fake count" />
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Content calendar
              </p>
              <span className="text-[11px] text-[var(--color-text-muted)]">Week · campaign days</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--color-text-muted)]">
              {week.map((d) => (
                <div key={d.toISOString()} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
                  <p>{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-primary)]">{d.getDate()}</p>
                  {(campaigns ?? [])
                    .filter((c) => {
                      const s = new Date(c.startDate);
                      return s.toDateString() === d.toDateString();
                    })
                    .slice(0, 1)
                    .map((c) => (
                      <p key={c.id} className="mt-1 truncate rounded bg-[var(--color-violet)]/30 px-0.5 text-[9px] text-[var(--color-violet)]">
                        {c.topic}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-5">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Publishing queue
            </p>
            <ul className="mt-2 space-y-2">
              {pubs.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-2 text-[12px]">
                  <span>{p.name}</span>
                  <span className={p.configured ? "text-[var(--color-teal)]" : "text-[var(--color-text-muted)]"}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-5">
            <p className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Post composer
            </p>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mb-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
            >
              {pubs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="mb-2 flex gap-1">
              {(["Clear", "Expert", "Conversational"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVoice(v)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    voice === v ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Caption…"
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!caption.trim() || !scripts?.[0] || extract.isPending}
                onClick={() => {
                  if (!scripts?.[0]) {
                    setMsg("Create a script in Drafts first to attach claim extract");
                    return;
                  }
                  extract.mutate({ scriptId: scripts[0].id, text: caption.trim() });
                }}
                className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px]"
              >
                Check claims
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--color-violet)] px-2 py-1 text-[11px] font-medium text-white"
                onClick={() =>
                  setMsg(
                    pubs.find((p) => p.id === channel)?.configured
                      ? `Ready for approval queue (${voice}). Publish still requires platform token + approval gate.`
                      : `${channel} connector not configured in .env`,
                  )
                }
              >
                Send for approval
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-4">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Approval & evidence
            </p>
            <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
              Pending claims: {summary?.byStatus.pending ?? 0} · Awaiting tasks: {awaiting?.length ?? 0}
            </p>
            <p className="mt-2 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 p-2 text-[11px] text-[var(--color-amber)]">
              Unsupported claims pause publishing — use Evidence + Approvals.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-3">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Unified inbox
            </p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-[11px]">
              {(events ?? []).slice(0, 8).map((e) => (
                <li key={e.id} className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5">
                  <p className="text-[var(--color-text-primary)]">{e.message}</p>
                  <p className="text-[var(--color-text-muted)]">{e.eventType}</p>
                </li>
              ))}
              {!events?.length && (
                <li className="text-[var(--color-text-muted)]">No platform DMs — showing agent events instead</li>
              )}
            </ul>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap gap-4 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        {(events ?? []).slice(0, 5).map((e) => (
          <span key={e.id}>
            {e.message.slice(0, 40)} · {new Date(e.createdAt).toLocaleTimeString()}
          </span>
        ))}
      </footer>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3" style={{ boxShadow: `0 0 24px color-mix(in srgb, ${tone} 15%, transparent)` }}>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="font-[var(--font-display)] text-2xl" style={{ color: tone }}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
