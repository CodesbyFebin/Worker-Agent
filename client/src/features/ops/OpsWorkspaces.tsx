import { useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

export function CalendarWorkspace() {
  const { data: campaigns } = trpc.campaign.list.useQuery();
  const [view, setView] = useState<"week" | "month">("week");

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const n = view === "week" ? 7 : 28;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Calendar"
        status="Campaign schedule"
        statusTone="teal"
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-lg px-2 py-1 text-[11px] ${view === "week" ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`rounded-lg px-2 py-1 text-[11px] ${view === "month" ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"}`}
            >
              Month
            </button>
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={`grid gap-2 ${view === "week" ? "grid-cols-7" : "grid-cols-7"}`}>
          {days.map((d) => {
            const items = (campaigns ?? []).filter((c) => {
              const s = new Date(c.startDate);
              // show campaign across its day window lightly
              const end = new Date(s);
              end.setDate(s.getDate() + c.totalDays);
              return d >= s && d <= end;
            });
            return (
              <div key={d.toISOString()} className="min-h-24 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-2">
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </p>
                {items.slice(0, 3).map((c) => (
                  <p
                    key={c.id}
                    className="mt-1 truncate rounded bg-[var(--color-violet)]/25 px-1 text-[10px] text-[var(--color-violet)]"
                    title={c.topic}
                  >
                    {c.topic}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
          Blocks = campaigns spanning startDate → startDate+totalDays (real). Not a fake social calendar.
        </p>
      </div>
    </div>
  );
}

export function SettingsWorkspace() {
  const { data } = trpc.connectors.list.useQuery();
  const { data: llm } = trpc.settings.getLlm.useQuery(undefined, { refetchInterval: 10_000 });
  const { data: orFree } = trpc.settings.listOpenRouterFree.useQuery();
  const { data: nvidia } = trpc.settings.listNvidiaModels.useQuery();
  const setLlm = trpc.settings.setLlm.useMutation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="Settings" status={`LLM: ${llm?.activeProvider ?? "…"}`} statusTone="violet" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="text-[14px] font-semibold">Active model (all pages)</h2>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              Provider={llm?.activeProvider} · Model={llm?.activeModel} · prefs in{" "}
              <code className="font-[var(--font-mono)]">.llm-prefs.json</code>
            </p>

            <h3 className="mt-4 text-[12px] font-semibold text-[var(--color-teal)]">NVIDIA NIM</h3>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-line)]">
              {(nvidia?.models ?? []).map((m) => (
                <button
                  key={`nv-${m.id}`}
                  type="button"
                  onClick={() => setLlm.mutate({ provider: "nvidia", model: m.id })}
                  className={`block w-full truncate border-b border-[var(--color-line)]/50 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--color-ink)] ${
                    llm?.activeProvider === "nvidia" && llm?.activeModel === m.id
                      ? "text-[var(--color-teal)]"
                      : ""
                  }`}
                >
                  {m.name} · {m.id}
                </button>
              ))}
              {!nvidia?.models?.length && (
                <p className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">No NIM models</p>
              )}
            </div>

            <h3 className="mt-4 text-[12px] font-semibold text-[var(--color-violet)]">OpenRouter free</h3>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-line)]">
              {(orFree?.models ?? []).map((m) => (
                <button
                  key={`or-${m.id}`}
                  type="button"
                  onClick={() => setLlm.mutate({ provider: "openrouter", model: m.id })}
                  className={`block w-full truncate border-b border-[var(--color-line)]/50 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--color-ink)] ${
                    llm?.activeProvider === "openrouter" && llm?.activeModel === m.id
                      ? "text-[var(--color-teal)]"
                      : ""
                  }`}
                >
                  {m.id}
                </button>
              ))}
              {!orFree?.models?.length && (
                <p className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">No free models listed</p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="text-[14px] font-semibold">Connectors summary</h2>
            <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
              {data?.summary.connected ?? 0} connected · {data?.summary.needsAttention ?? 0} need attention ·{" "}
              {data?.summary.available ?? 0} available
            </p>
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Edit secrets in <code className="font-[var(--font-mono)]">.env</code> — never pasted into this UI.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function GovernanceWorkspace() {
  const [rules, setRules] = useState({
    multiSource: true,
    flagConflict: true,
    pauseUnsupported: true,
    humanReview: true,
    checkStats: true,
    checkQuotes: true,
  });
  const { data: summary } = trpc.ledger.summary.useQuery();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="Governance" status="Trust gates" statusTone="violet" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Policy toggles stored in this browser. Enforcement for publish still goes through real{" "}
            <code className="font-[var(--font-mono)]">awaiting_approval</code> publisher tasks.
          </p>
          {(
            [
              ["checkStats", "Check statistics"],
              ["checkQuotes", "Check quotations"],
              ["multiSource", "Require multiple sources"],
              ["flagConflict", "Flag conflicting evidence"],
              ["pauseUnsupported", "Pause unsupported claims"],
              ["humanReview", "Require human review before publish"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between text-[13px]">
              {label}
              <input
                type="checkbox"
                checked={rules[k]}
                onChange={(e) => setRules({ ...rules, [k]: e.target.checked })}
              />
            </label>
          ))}
          <div className="rounded-xl border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/5 p-3 text-[12px] text-[var(--color-teal)]">
            Ledger now: {summary?.byStatus.pending ?? 0} pending · {summary?.byStatus.verified ?? 0} verified ·{" "}
            {summary?.byStatus.rejected ?? 0} rejected
          </div>
        </div>
      </div>
    </div>
  );
}
