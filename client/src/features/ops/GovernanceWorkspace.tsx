import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

type Tab = "approvals" | "policy" | "budget" | "security" | "audit";

/**
 * Governance — durable policies, unified approvals with payload binding,
 * budgets, security events, audit log (Phase 8). Replaces localStorage toggles.
 */
export function GovernanceWorkspace({ initialTab = "approvals" }: { initialTab?: Tab }) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const policy = trpc.governance.getPolicy.useQuery();
  const approvals = trpc.governance.listApprovals.useQuery(
    { status: "pending", limit: 40 },
    { refetchInterval: 4000 },
  );
  const decided = trpc.governance.listApprovals.useQuery({ limit: 20 }, { refetchInterval: 8000 });
  const budget = trpc.governance.getBudget.useQuery(undefined, { refetchInterval: 10_000 });
  const security = trpc.governance.listSecurityEvents.useQuery({ limit: 40 });
  const audit = trpc.governance.listAudit.useQuery({ limit: 40 });
  const ledger = trpc.ledger.summary.useQuery();

  const [rules, setRules] = useState({
    multiSource: true,
    flagConflict: true,
    pauseUnsupported: true,
    humanReview: true,
    checkStats: true,
    checkQuotes: true,
  });
  const [requireHumanReview, setRequireHumanReview] = useState(true);
  const [pauseUnsupportedClaims, setPauseUnsupportedClaims] = useState(true);
  const [limitUsd, setLimitUsd] = useState("50");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "lifetime">("monthly");
  const [enforcement, setEnforcement] = useState<"soft" | "hard">("hard");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!policy.data) return;
    setRules({ ...rules, ...policy.data.rules });
    setRequireHumanReview(policy.data.requireHumanReview);
    setPauseUnsupportedClaims(policy.data.pauseUnsupportedClaims);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy.data?.id, policy.data?.updatedAt]);

  useEffect(() => {
    if (budget.data?.configured && budget.data.limitUsd != null) {
      setLimitUsd(String(budget.data.limitUsd));
      if (budget.data.period) setPeriod(budget.data.period as typeof period);
      if (budget.data.enforcement === "soft" || budget.data.enforcement === "hard") {
        setEnforcement(budget.data.enforcement);
      }
    }
  }, [budget.data]);

  const setPolicy = trpc.governance.setPolicy.useMutation({
    onSuccess: () => {
      setMsg("Governance policy saved to DB");
      void utils.governance.getPolicy.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const sync = trpc.governance.syncApprovals.useMutation({
    onSuccess: (r) => {
      setMsg(`Synced · ${r.created} new · scanned ${r.scannedSteps} steps + ${r.scannedTasks} tasks`);
      void utils.governance.listApprovals.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const decide = trpc.governance.decide.useMutation({
    onSuccess: (r) => {
      setMsg(`${r.resourceType} ${r.resourceId.slice(0, 8)}… decided`);
      void utils.governance.listApprovals.invalidate();
      void utils.governance.listSecurityEvents.invalidate();
      void utils.governance.listAudit.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const setBudget = trpc.governance.setBudget.useMutation({
    onSuccess: () => {
      setMsg("Budget saved");
      void utils.governance.getBudget.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Governance"
        status={
          budget.data?.exceeded
            ? "Budget exceeded"
            : `${approvals.data?.length ?? 0} pending approvals`
        }
        statusTone={budget.data?.exceeded ? "amber" : "violet"}
        actions={
          <button
            type="button"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[11px]"
          >
            <RefreshCw size={12} /> Sync queue
          </button>
        }
      />
      {msg && (
        <p className="shrink-0 border-b border-[var(--color-line)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
          {msg}
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)] px-3 py-2">
        {(
          [
            ["approvals", "Approvals"],
            ["policy", "Policies"],
            ["budget", "Budgets"],
            ["security", "Security"],
            ["audit", "Audit log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] ${
              tab === id ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "approvals" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Unified queue with payload hash binding. Approving a `workflow_step` resumes the run;
              approving an `agent_task` resets it to pending.
            </p>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Decision note (optional)
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            {(approvals.data ?? []).length === 0 && (
              <p className="text-[12px] text-[var(--color-text-muted)]">
                No pending approvals. Run a workflow with a human.approval node, or Sync queue.
              </p>
            )}
            <ul className="space-y-2">
              {(approvals.data ?? []).map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[12px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{a.summary}</p>
                      <p className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                        {a.resourceType}:{a.resourceId.slice(0, 8)}… · hash {a.payloadHash.slice(0, 12)}…
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({ approvalId: a.id, decision: "approved", note: note || undefined })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink)]"
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({ approvalId: a.id, decision: "rejected", note: note || undefined })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-amber)] px-2 py-1 text-[10px] text-[var(--color-amber)]"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <h3 className="text-[12px] font-semibold">Recent decisions</h3>
              <ul className="mt-2 space-y-1">
                {(decided.data ?? [])
                  .filter((a) => a.status !== "pending")
                  .slice(0, 10)
                  .map((a) => (
                    <li key={a.id} className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                      {a.status} · {a.title}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "policy" && (
          <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <p className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
              <ShieldCheck size={14} /> Persisted in `governance_policies` — not browser storage.
            </p>
            {(
              [
                ["checkStats", "Check statistics"],
                ["checkQuotes", "Check quotations"],
                ["multiSource", "Require multiple sources"],
                ["flagConflict", "Flag conflicting evidence"],
                ["pauseUnsupported", "Pause unsupported claims (rule flag)"],
                ["humanReview", "Prefer human review before publish (rule flag)"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between text-[13px]">
                {label}
                <input
                  type="checkbox"
                  checked={Boolean(rules[k])}
                  onChange={(e) => setRules({ ...rules, [k]: e.target.checked })}
                />
              </label>
            ))}
            <label className="flex items-center justify-between text-[13px]">
              Require human review (enforced flag)
              <input
                type="checkbox"
                checked={requireHumanReview}
                onChange={(e) => setRequireHumanReview(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-[13px]">
              Pause unsupported claims (enforced flag)
              <input
                type="checkbox"
                checked={pauseUnsupportedClaims}
                onChange={(e) => setPauseUnsupportedClaims(e.target.checked)}
              />
            </label>
            <div className="rounded-xl border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/5 p-3 text-[12px] text-[var(--color-teal)]">
              Ledger now: {ledger.data?.byStatus.pending ?? 0} pending · {ledger.data?.byStatus.verified ?? 0}{" "}
              verified · {ledger.data?.byStatus.rejected ?? 0} rejected
            </div>
            <button
              type="button"
              disabled={setPolicy.isPending}
              onClick={() =>
                setPolicy.mutate({
                  rules,
                  requireHumanReview,
                  pauseUnsupportedClaims,
                })
              }
              className="rounded-lg bg-[var(--color-violet)] px-3 py-1.5 text-[11px] text-white disabled:opacity-50"
            >
              Save policy
            </button>
          </div>
        )}

        {tab === "budget" && (
          <div className="mx-auto max-w-md space-y-3">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-[12px]">
              {budget.data?.configured ? (
                <>
                  <p>
                    Spent ${budget.data.spentUsd?.toFixed(4)} / ${budget.data.limitUsd} ({budget.data.period})
                  </p>
                  <p className="mt-1 text-[var(--color-text-muted)]">
                    Remaining ${budget.data.remainingUsd?.toFixed(4)} · enforcement={budget.data.enforcement}
                    {budget.data.exceeded ? " · EXCEEDED" : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    From real `agent_tasks.cost_usd` + `agent_executions.cost_usd` since {budget.data.since}
                  </p>
                </>
              ) : (
                <p className="text-[var(--color-text-muted)]">No budget configured yet.</p>
              )}
            </div>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Limit USD
              <input
                value={limitUsd}
                onChange={(e) => setLimitUsd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Period
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="lifetime">lifetime</option>
              </select>
            </label>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Enforcement
              <select
                value={enforcement}
                onChange={(e) => setEnforcement(e.target.value as "soft" | "hard")}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              >
                <option value="hard">hard (deny agent runs)</option>
                <option value="soft">soft (security event only)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={setBudget.isPending}
              onClick={() =>
                setBudget.mutate({
                  period,
                  limitUsd: Number(limitUsd),
                  enforcement,
                })
              }
              className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)]"
            >
              Save budget
            </button>
          </div>
        )}

        {tab === "security" && (
          <div className="mx-auto max-w-3xl">
            <ul className="space-y-2">
              {(security.data ?? []).map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-[var(--font-mono)] text-[var(--color-amber)]">
                      {e.severity} · {e.kind}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1">{e.message}</p>
                </li>
              ))}
              {(security.data ?? []).length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">No security events yet.</p>
              )}
            </ul>
          </div>
        )}

        {tab === "audit" && (
          <div className="mx-auto max-w-3xl">
            <ul className="space-y-2">
              {(audit.data ?? []).map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-[var(--font-mono)] text-[var(--color-teal)]">{e.action}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[var(--color-text-muted)]">
                    {e.resourceType}/{e.resourceId}
                  </p>
                </li>
              ))}
              {(audit.data ?? []).length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">No audit rows for this org.</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

