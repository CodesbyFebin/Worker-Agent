import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

/** Real workflow templates — each Use template calls an existing API. */
const TEMPLATES = [
  {
    id: "weekly-authority",
    title: "Weekly Authority Content Engine",
    description: "7-day YouTube AutoMode campaign with human publish gate",
    category: "Creators",
    steps: ["Topic Research", "Content Brief", "Drafts", "Claim Evidence", "Human Approval", "Schedule", "Publish", "Learning"],
    action: "campaign" as const,
    days: 7,
  },
  {
    id: "shorts-series",
    title: "Short-Form Series (3 days)",
    description: "Fast AutoMode run for Shorts pipeline testing",
    category: "Creators",
    steps: ["Research", "Script", "Video", "Captions", "Approval", "Publish"],
    action: "campaign" as const,
    days: 3,
  },
  {
    id: "god-machine-goal",
    title: "God Machine Goal Dispatch",
    description: "Planner → multi-agent Codex chain on a free-text goal",
    category: "SaaS",
    steps: ["Plan", "Research/Code", "Review", "QA"],
    action: "god" as const,
    days: 0,
  },
  {
    id: "claim-sweep",
    title: "Claim Evidence Sweep",
    description: "Verify pending ledger claims (needs search + LLM keys)",
    category: "Agencies",
    steps: ["Extract", "Search", "Verify", "Review"],
    action: "claims" as const,
    days: 0,
  },
];

export function TemplateLibraryWorkspace() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState("All templates");
  const [topic, setTopic] = useState("Weekly authority content");
  const [goal, setGoal] = useState("Ship a Short script with verified claims");
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState(TEMPLATES[0].id);

  const tpl = TEMPLATES.find((t) => t.id === selected) ?? TEMPLATES[0];

  const start = trpc.campaign.start.useMutation({
    onSuccess: (r) => {
      utils.campaign.list.invalidate();
      setMsg(`Campaign started: ${r.campaignId}`);
    },
    onError: (e) => setMsg(e.message),
  });
  const dispatch = trpc.godMachine.dispatchGoal.useMutation({
    onSuccess: (r) => setMsg(`God Machine root: ${r.rootTaskId}`),
    onError: (e) => setMsg(e.message),
  });
  const verify = trpc.ledger.verifyPendingBatch.useMutation({
    onSuccess: (r) => setMsg(`Verified ${r.verified} pending claim(s)`),
    onError: (e) => setMsg(e.message),
  });

  function applyTemplate(id?: string) {
    const t = TEMPLATES.find((x) => x.id === (id ?? selected)) ?? tpl;
    if (t.action === "campaign") start.mutate({ topic: topic.trim() || t.title, totalDays: t.days });
    else if (t.action === "god") dispatch.mutate({ goal: goal.trim() || t.title });
    else verify.mutate({ limit: 3 });
  }

  const shown =
    filter === "All templates"
      ? TEMPLATES
      : TEMPLATES.filter((t) => filter === t.category || filter.includes(t.category));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Template Library"
        status={`${TEMPLATES.length} real workflows`}
        statusTone="violet"
        actions={
          <button
            type="button"
            onClick={() => setMsg("Custom workflow = God Machine goal or campaign.start — no fake marketplace count")}
            className="rounded-full bg-[var(--color-violet)] px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            + Create custom workflow
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h1 className="text-[22px] font-semibold text-[var(--color-teal)]">
          Prebuilt automation library
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-text-muted)]">
          Templates below call real WorkerAgent APIs (campaign / God Machine / ledger). Not a fake
          &quot;1000+&quot; catalog.
        </p>

        {msg && (
          <p className="mt-2 text-[12px] text-[var(--color-teal)]">
            {msg}{" "}
            <button type="button" className="text-[var(--color-text-muted)]" onClick={() => setMsg(null)}>
              dismiss
            </button>
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {["All templates", "Creators", "Agencies", "SaaS"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] ${
                filter === f
                  ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)] ring-1 ring-[var(--color-violet)]/40"
                  : "border border-[var(--color-line)] text-[var(--color-text-muted)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_300px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map(
              (t) => (
                <div
                  key={t.id}
                  className={`rounded-2xl border bg-[var(--color-surface)] p-4 ${
                    selected === t.id ? "border-[var(--color-violet)] shadow-[var(--glow-magenta)]" : "border-[var(--color-line)]"
                  }`}
                >
                  <button type="button" className="w-full text-left" onClick={() => setSelected(t.id)}>
                    <p className="text-[14px] font-semibold">{t.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{t.description}</p>
                    <div className="mt-2 flex gap-1">
                      {t.steps.slice(0, 5).map((_, i) => (
                        <span key={i} className="h-1.5 flex-1 rounded-full bg-[var(--color-violet)]/50" />
                      ))}
                    </div>
                    <span className="mt-2 inline-block text-[10px] uppercase text-[var(--color-violet)]">{t.category}</span>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(t.id)}
                      className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px]"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(t.id);
                        applyTemplate(t.id);
                      }}
                      className="rounded-lg bg-[var(--color-violet)] px-2 py-1 text-[11px] font-medium text-white"
                    >
                      Use template
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>

          <aside className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Template preview
            </p>
            <h3 className="mt-2 text-[15px] font-semibold">{tpl.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-full bg-[var(--color-violet)]/20 px-2 py-0.5 text-[10px] text-[var(--color-violet)]">
                {tpl.category}
              </span>
            </div>
            <ol className="mt-3 space-y-1.5 text-[12px]">
              {tpl.steps.map((s, i) => (
                <li key={s} className="flex gap-2">
                  <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            {tpl.action === "campaign" && (
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-3 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                placeholder="Campaign topic"
              />
            )}
            {tpl.action === "god" && (
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                className="mt-3 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            )}
            <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-2 text-[11px] text-[var(--color-text-muted)]">
              Approval policy: human gate · Evidence: claim ledger
            </div>
            <button
              type="button"
              disabled={start.isPending || dispatch.isPending || verify.isPending}
              onClick={() => applyTemplate()}
              className="mt-3 w-full rounded-xl bg-[var(--color-violet)] py-2.5 text-[13px] font-semibold text-white shadow-[var(--glow-magenta)]"
            >
              Use template
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
