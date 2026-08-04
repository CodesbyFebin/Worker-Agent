import { useMemo, useState } from "react";
import { Check, Clock, Play, Shield, User } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

type StepDef = {
  id: string;
  n: number;
  title: string;
  blurb: string;
  roles: string[];
};

const STEPS: StepDef[] = [
  { id: "discover", n: 1, title: "Discover Topic", blurb: "Campaign topic / planner", roles: ["planner"] },
  { id: "sources", n: 2, title: "Collect Sources", blurb: "Research stage gathers material", roles: ["researcher"] },
  { id: "insights", n: 3, title: "Summarize Insights", blurb: "Research summary", roles: ["researcher"] },
  { id: "claims", n: 4, title: "Validate Claims", blurb: "Claim ledger + verify", roles: ["reviewer"] },
  { id: "content", n: 5, title: "Generate Content", blurb: "Writer / script draft", roles: ["writer"] },
  { id: "variants", n: 6, title: "Create Variants", blurb: "Captions, SEO, metadata", roles: ["caption_hashtag", "seo"] },
  { id: "approval", n: 7, title: "Human Approval", blurb: "Publisher awaiting_approval", roles: ["publisher"] },
  { id: "schedule", n: 8, title: "Ready to Schedule", blurb: "BullMQ delayed publish", roles: ["publisher"] },
];

/**
 * Research-to-Post / Automations canvas — steps mirror real campaign pipeline.
 */
export function AutomationsPipelineWorkspace({ variant = "research-to-post" }: { variant?: "research-to-post" | "automations" }) {
  const utils = trpc.useUtils();
  const { data: campaigns } = trpc.campaign.list.useQuery();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const activeId = campaignId ?? campaigns?.[0]?.id ?? null;
  const { data: days } = trpc.campaign.getDays.useQuery(
    { campaignId: activeId! },
    { enabled: Boolean(activeId), refetchInterval: 4000 },
  );
  const day = days?.[0];
  const stages = day?.stages ?? [];
  const [selected, setSelected] = useState("claims");
  const [toggles, setToggles] = useState({
    stats: true,
    quotes: true,
    dates: true,
    conflict: true,
    pauseUnsupported: true,
  });

  const start = trpc.campaign.start.useMutation({
    onSuccess: (r) => {
      setCampaignId(r.campaignId);
      utils.campaign.list.invalidate();
    },
  });
  const setStatus = trpc.campaign.setStatus.useMutation({
    onSuccess: () => utils.campaign.list.invalidate(),
  });
  const approve = trpc.campaign.approveDay.useMutation({
    onSuccess: () => utils.campaign.getDays.invalidate(),
  });

  const stepStatus = useMemo(() => {
    const map: Record<string, "configured" | "waiting" | "review" | "done"> = {};
    for (const step of STEPS) {
      const matched = stages.filter((s) => step.roles.includes(s.agentRole));
      if (!matched.length) {
        map[step.id] = activeId ? "waiting" : "configured";
        continue;
      }
      if (matched.some((s) => s.status === "awaiting_approval")) map[step.id] = "review";
      else if (matched.every((s) => s.status === "completed")) map[step.id] = "done";
      else if (matched.some((s) => s.status === "running" || s.status === "assigned")) map[step.id] = "review";
      else if (matched.some((s) => s.status === "failed" || s.status === "blocked")) map[step.id] = "review";
      else map[step.id] = "waiting";
    }
    return map;
  }, [stages, activeId]);

  const selectedStep = STEPS.find((s) => s.id === selected) ?? STEPS[3];
  const publisher = stages.find((s) => s.agentRole === "publisher");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title={variant === "automations" ? "Content Automation" : "Research-to-Post"}
        status={day ? `Day ${day.day.dayIndex} · ${day.day.status}` : "Draft workflow"}
        statusTone="amber"
        actions={
          <>
            <button
              type="button"
              disabled={!activeId || start.isPending}
              onClick={() =>
                start.mutate({
                  topic: campaigns?.find((c) => c.id === activeId)?.topic ?? "Test research-to-post topic",
                  totalDays: 3,
                })
              }
              className="btn-vibe-secondary flex items-center gap-1 px-3 py-1.5 text-[12px]"
            >
              <Play size={12} /> Test pipeline
            </button>
            <button
              type="button"
              disabled={!activeId || !campaigns?.find((c) => c.id === activeId) || setStatus.isPending}
              onClick={() => {
                const c = campaigns?.find((x) => x.id === activeId);
                if (!c) return;
                setStatus.mutate({
                  campaignId: c.id,
                  status: c.status === "paused" ? "active" : "active",
                });
              }}
              className="rounded-full bg-[var(--color-violet)] px-4 py-1.5 text-[12px] font-semibold text-white shadow-[var(--glow-magenta)]"
            >
              Activate
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold">
                {variant === "automations" ? "Content Automation" : "Research-to-Post Pipeline"}
              </h2>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Evidence-first, human-governed — steps map to real AutoMode / God Machine roles.
              </p>
            </div>
            <select
              value={activeId ?? ""}
              onChange={(e) => setCampaignId(e.target.value || null)}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
            >
              <option value="">Select campaign</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.topic}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step) => {
              const st = stepStatus[step.id];
              const active = selected === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelected(step.id)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-[var(--color-teal)] shadow-[var(--glow-cyan)]"
                      : "border-[var(--color-line)] bg-[var(--color-ink)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                      Step {step.n}
                    </span>
                    <StatusDot st={st} />
                  </div>
                  <p className="mt-1 text-[13px] font-medium">{step.title}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{step.blurb}</p>
                  {(step.id === "claims" || step.id === "approval") && (
                    <span className="mt-2 inline-block rounded bg-[var(--color-violet)]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-violet)]">
                      Trust gate
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {publisher?.status === "awaiting_approval" && day && (
            <div className="mt-4 rounded-xl border border-[var(--color-violet)] bg-[var(--color-violet)]/10 p-3">
              <p className="text-[12px] text-[var(--color-violet)]">Claims / publish review required</p>
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ dayRootTaskId: day.day.id })}
                className="mt-2 rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink)]"
              >
                Approve & schedule publish
              </button>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-3 text-[12px]">
              <p className="font-[var(--font-mono)] text-[9px] uppercase text-[var(--color-text-muted)]">Pipeline inputs</p>
              <ul className="mt-2 space-y-1 text-[var(--color-text-muted)]">
                <li>Topic queue: campaign list</li>
                <li>Audience: brief (local)</li>
                <li>Approval policy: human gate on publisher</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-3 text-[12px]">
              <p className="font-[var(--font-mono)] text-[9px] uppercase text-[var(--color-text-muted)]">Platform variants</p>
              <ul className="mt-2 space-y-1 text-[var(--color-text-primary)]">
                <li>Video Script · Shorts</li>
                <li>Professional Post</li>
                <li>Blog / Newsletter (Script Studio)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-3 text-[12px]">
              <p className="font-[var(--font-mono)] text-[9px] uppercase text-[var(--color-text-muted)]">Latest stages</p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                {stages.map((s) => (
                  <li key={s.id} className="flex items-center gap-1.5 text-[11px]">
                    {s.status === "completed" ? (
                      <Check size={12} className="text-[var(--color-teal)]" />
                    ) : s.status === "awaiting_approval" ? (
                      <User size={12} className="text-[var(--color-violet)]" />
                    ) : (
                      <Clock size={12} className="text-[var(--color-amber)]" />
                    )}
                    {s.agentRole} · {s.status}
                  </li>
                ))}
                {!stages.length && <li className="text-[var(--color-text-muted)]">No day stages yet</li>}
              </ul>
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 lg:w-80">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">
              {selectedStep.title} · Step {selectedStep.n} of {STEPS.length}
            </p>
            <Shield size={14} className="text-[var(--color-teal)]" />
          </div>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{selectedStep.blurb}</p>

          {selected === "claims" && (
            <div className="mt-4 space-y-2 text-[12px]">
              {(
                [
                  ["stats", "Check statistics"],
                  ["quotes", "Check quotations"],
                  ["dates", "Check dates"],
                  ["conflict", "Flag conflicting evidence"],
                  ["pauseUnsupported", "Pause on unsupported claims"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between text-[var(--color-text-muted)]">
                  {label}
                  <input
                    type="checkbox"
                    checked={toggles[k]}
                    onChange={(e) => setToggles({ ...toggles, [k]: e.target.checked })}
                  />
                </label>
              ))}
              <div className="mt-3 rounded-xl border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/5 p-3 text-[11px] text-[var(--color-teal)]">
                Unsupported claims cannot proceed to content generation when pause is on — enforced via human
                approval gate on publisher (real).
              </div>
            </div>
          )}

          {selected !== "claims" && (
            <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">
              Status: <span className="text-[var(--color-text-primary)]">{stepStatus[selected]}</span>
              <br />
              Roles: {selectedStep.roles.join(", ")}
            </p>
          )}
        </aside>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]">
        <span className="text-[var(--color-text-muted)]">Evidence lineage</span>
        {["Source material", "Extracted insight", "Claim", "Draft sentence", "Platform variant"].map((x, i) => (
          <span key={x} className="flex items-center gap-2 text-[var(--color-text-primary)]">
            {i > 0 && <span className="text-[var(--color-text-muted)]">→</span>}
            {x}
          </span>
        ))}
      </footer>
    </div>
  );
}

function StatusDot({ st }: { st: string }) {
  const color =
    st === "done"
      ? "bg-[var(--color-teal)]"
      : st === "review"
        ? "bg-[var(--color-amber)]"
        : st === "waiting"
          ? "bg-[var(--color-text-muted)]"
          : "bg-[var(--color-teal)]";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}
