import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  HelpCircle,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import type { ClaimVerificationStatus } from "../../../../shared/types";

const STATUS_META: Record<
  ClaimVerificationStatus,
  { label: string; color: string; icon: typeof Clock; blurb: string }
> = {
  pending: {
    label: "Pending",
    color: "var(--color-amber)",
    icon: Clock,
    blurb: "Awaiting web verification",
  },
  verified: {
    label: "Verified",
    color: "var(--color-teal)",
    icon: CheckCircle2,
    blurb: "Supported by fetched sources",
  },
  rejected: {
    label: "Rejected",
    color: "var(--color-coral)",
    icon: XCircle,
    blurb: "Contradicted or unsupported",
  },
  unverifiable: {
    label: "Unverifiable",
    color: "var(--color-text-muted)",
    icon: HelpCircle,
    blurb: "No decisive source found",
  },
};

const STATUS_OPTIONS: ClaimVerificationStatus[] = ["pending", "verified", "rejected", "unverifiable"];

function formatPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** SVG donut from real status counts — empty ring when total is 0. */
function StatusDonut({
  byStatus,
  total,
}: {
  byStatus: Record<ClaimVerificationStatus, number>;
  total: number;
}) {
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const order: ClaimVerificationStatus[] = ["verified", "pending", "rejected", "unverifiable"];
  let offset = 0;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          order.map((key) => {
            const n = byStatus[key];
            if (!n) return null;
            const len = (n / total) * c;
            const el = (
              <circle
                key={key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={STATUS_META[key].color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-[var(--font-display)] text-2xl text-[var(--color-text-primary)]">{total}</p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">claims</p>
      </div>
    </div>
  );
}

/** Hourly claim creations today — real buckets only. */
function HourlySpark({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const w = 320;
  const h = 120;
  const pad = 8;
  const pts = hourly
    .map((v, i) => {
      const x = pad + (i / 23) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
      <polyline
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="2"
        points={pts}
        opacity={0.9}
      />
      {hourly.map((v, i) => {
        if (v === 0) return null;
        const x = pad + (i / 23) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--color-amber)" />;
      })}
    </svg>
  );
}

/**
 * Claim Ledger Mission Control — layout inspired by command-center dashboards,
 * metrics computed only from claim_ledger (no fabricated growth %).
 */
export function ClaimLedgerWorkspace() {
  const [scriptFilter, setScriptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ClaimVerificationStatus | "all">("all");
  const [clock, setClock] = useState(() => new Date());
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [extractScriptId, setExtractScriptId] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: scripts } = trpc.script.list.useQuery();
  const scriptId = scriptFilter === "all" ? undefined : scriptFilter;

  const summaryQ = trpc.ledger.summary.useQuery(
    scriptId ? { scriptId } : undefined,
    { refetchInterval: 8_000 },
  );
  const recentQ = trpc.ledger.listRecent.useQuery(
    { scriptId, limit: 80 },
    { refetchInterval: 5_000 },
  );

  const extractMut = trpc.ledger.extractAndLog.useMutation({
    onSuccess: () => {
      utils.ledger.summary.invalidate();
      utils.ledger.listRecent.invalidate();
      setExtractText("");
      setExtractOpen(false);
    },
  });
  const verifyMut = trpc.ledger.verifyClaim.useMutation({
    onSuccess: () => {
      utils.ledger.summary.invalidate();
      utils.ledger.listRecent.invalidate();
    },
  });
  const batchMut = trpc.ledger.verifyPendingBatch.useMutation({
    onSuccess: () => {
      utils.ledger.summary.invalidate();
      utils.ledger.listRecent.invalidate();
    },
  });
  const setStatusMut = trpc.ledger.setStatus.useMutation({
    onSuccess: () => {
      utils.ledger.summary.invalidate();
      utils.ledger.listRecent.invalidate();
    },
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!extractScriptId && scripts?.[0]?.id) setExtractScriptId(scripts[0].id);
  }, [scripts, extractScriptId]);

  const summary = summaryQ.data;
  const claims = useMemo(() => {
    const rows = recentQ.data ?? [];
    if (statusFilter === "all") return rows;
    return rows.filter((c) => c.verificationStatus === statusFilter);
  }, [recentQ.data, statusFilter]);

  const pendingCount = summary?.byStatus.pending ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      {/* Top KPI strip */}
      <header className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)]/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          <div className="mr-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-coral)]/50 bg-[var(--color-coral)]/10 shadow-[var(--glow-magenta)]">
              <ShieldCheck size={18} className="text-[var(--color-teal)]" />
            </div>
            <div>
              <p className="text-vibe-brand text-[14px] tracking-wide">Claim Ledger</p>
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Mission Control
              </p>
            </div>
          </div>

          <Kpi
            label="Total claims"
            value={summary ? String(summary.total) : "…"}
            hint={scriptId ? "This script" : "All scripts"}
          />
          <Kpi label="Logged today" value={summary ? String(summary.todayCount) : "…"} hint="Since local midnight" />
          <Kpi
            label="Verified rate"
            value={formatPct(summary?.verificationRate ?? null)}
            hint="Of resolved claims only"
          />
          <Kpi
            label="Avg confidence"
            value={
              summary?.avgConfidence != null ? summary.avgConfidence.toFixed(2) : "—"
            }
            hint="Where scores exist"
          />
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/5 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-teal)]" />
            <span className="text-[12px] text-[var(--color-teal)]">
              {summaryQ.isError ? "Ledger API error" : "Ledger live"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
            <span className="font-[var(--font-display)] tabular-nums">
              {clock.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={() => {
                summaryQ.refetch();
                recentQ.refetch();
              }}
              className="rounded-lg p-1.5 hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
              title="Refresh"
            >
              <RefreshCw size={14} className={summaryQ.isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
        {/* Banner */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-ink)] px-5 py-4">
          <div>
            <h1 className="font-[var(--font-display)] text-lg tracking-wide text-[var(--color-text-primary)] sm:text-xl">
              Safe Deep · Claim Mission Control
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--color-text-muted)]">
              Every factual claim extracted from scripts — verified against real web sources. Counts
              below are live from the ledger, not demo metrics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
              Script
              <select
                value={scriptFilter}
                onChange={(e) => setScriptFilter(e.target.value)}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[13px] text-[var(--color-text-primary)]"
              >
                <option value="all">All scripts</option>
                {(scripts ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Status squad cards */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(STATUS_META) as ClaimVerificationStatus[]).map((key) => {
            const meta = STATUS_META[key];
            const Icon = meta.icon;
            const n = summary?.byStatus[key] ?? 0;
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : key)}
                className={`rounded-2xl border bg-[var(--color-surface)] p-4 text-left transition ${
                  active ? "border-[var(--color-teal)]/60" : "border-[var(--color-line)] hover:border-[var(--color-text-muted)]/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 18%, transparent)` }}
                  >
                    <Icon size={18} style={{ color: meta.color }} />
                  </div>
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    {active ? "Filtered" : "Live"}
                  </span>
                </div>
                <p className="mt-3 text-[14px] font-medium text-[var(--color-text-primary)]">{meta.label}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{meta.blurb}</p>
                <div className="mt-3 flex items-end justify-between border-t border-[var(--color-line)] pt-3">
                  <div>
                    <p className="font-[var(--font-display)] text-2xl" style={{ color: meta.color }}>
                      {summaryQ.isLoading ? "…" : n}
                    </p>
                    <p className="text-[10px] uppercase text-[var(--color-text-muted)]">claims</p>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {summary && summary.total > 0 ? `${((n / summary.total) * 100).toFixed(0)}% of total` : "—"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Charts + activity row */}
        <div className="mb-4 grid gap-3 lg:grid-cols-12">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Claims logged today
              </p>
              <Radar size={14} className="text-[var(--color-teal)]" />
            </div>
            {summary && summary.todayCount === 0 ? (
              <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                No claims created since midnight
              </p>
            ) : (
              <HourlySpark hourly={summary?.hourlyToday ?? Array(24).fill(0)} />
            )}
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Hourly buckets · local timezone</p>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 lg:col-span-4">
            <p className="mb-2 font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Status overview
            </p>
            <StatusDonut
              byStatus={summary?.byStatus ?? { pending: 0, verified: 0, rejected: 0, unverifiable: 0 }}
              total={summary?.total ?? 0}
            />
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {(Object.keys(STATUS_META) as ClaimVerificationStatus[]).map((k) => (
                <div key={k} className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: STATUS_META[k].color }} />
                  {STATUS_META[k].label} · {summary?.byStatus[k] ?? 0}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 lg:col-span-3">
            <p className="mb-3 font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Ledger vitals
            </p>
            <ul className="space-y-3 text-[13px]">
              <Vital label="With source URL" value={String(summary?.withSource ?? "…")} />
              <Vital label="Pending queue" value={String(pendingCount)} accent="var(--color-amber)" />
              <Vital
                label="Verified"
                value={String(summary?.byStatus.verified ?? "…")}
                accent="var(--color-teal)"
              />
              <Vital
                label="Rejected"
                value={String(summary?.byStatus.rejected ?? "…")}
                accent="var(--color-coral)"
              />
            </ul>
          </section>
        </div>

        {/* Table + feed + commands */}
        <div className="grid gap-3 lg:grid-cols-12">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <p className="font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Claim register
                {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
              </p>
              <span className="text-[11px] text-[var(--color-text-muted)]">{claims.length} shown</span>
            </div>
            {recentQ.isLoading && (
              <p className="flex items-center gap-2 px-4 py-8 text-[13px] text-[var(--color-text-muted)]">
                <Loader2 size={14} className="animate-spin" /> Loading ledger…
              </p>
            )}
            {recentQ.isError && (
              <p className="px-4 py-8 text-[13px] text-[var(--color-coral)]">{recentQ.error.message}</p>
            )}
            {!recentQ.isLoading && claims.length === 0 && (
              <p className="px-4 py-8 text-[13px] text-[var(--color-text-muted)]">
                No claims yet. Extract from a script, or clear the status filter.
              </p>
            )}
            <ul className="max-h-[420px] divide-y divide-[var(--color-line)] overflow-y-auto">
              {claims.map((claim) => {
                const meta = STATUS_META[claim.verificationStatus];
                return (
                  <li key={claim.id} className="flex gap-3 px-4 py-3 hover:bg-[var(--color-surface-raised)]/60">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
                    >
                      <FileSearch size={15} style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{claim.devtag}</span>
                        <span
                          className="rounded border px-1.5 py-0.5 text-[10px] uppercase"
                          style={{ color: meta.color, borderColor: meta.color }}
                        >
                          {claim.verificationStatus}
                        </span>
                        {claim.scriptTitle && (
                          <span className="truncate text-[11px] text-[var(--color-text-muted)]">
                            {claim.scriptTitle}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-[var(--color-text-primary)]">{claim.claimText}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <span>
                          conf{" "}
                          {claim.confidenceScore != null ? claim.confidenceScore.toFixed(2) : "—"}
                        </span>
                        <span>·</span>
                        <span>{relativeTime(claim.createdAt)}</span>
                        {claim.sourceUrl && (
                          <a
                            href={claim.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-teal)] hover:underline"
                          >
                            source
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={verifyMut.isPending}
                          onClick={() => verifyMut.mutate({ claimId: claim.id })}
                          className="rounded border border-[var(--color-line)] px-1.5 py-0.5 hover:text-[var(--color-text-primary)]"
                        >
                          verify
                        </button>
                        <select
                          value=""
                          disabled={setStatusMut.isPending}
                          onChange={(e) => {
                            const next = e.target.value as ClaimVerificationStatus;
                            if (next) setStatusMut.mutate({ claimId: claim.id, status: next });
                          }}
                          className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-1 py-0.5"
                        >
                          <option value="">override…</option>
                          {STATUS_OPTIONS.filter((s) => s !== claim.verificationStatus).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex flex-col gap-3 lg:col-span-5">
            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="mb-3 font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Recent activity
              </p>
              <ul className="max-h-56 space-y-3 overflow-y-auto">
                {(recentQ.data ?? []).slice(0, 12).map((c) => (
                  <li key={c.id} className="flex gap-2 text-[12px]">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_META[c.verificationStatus].color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[var(--color-text-primary)]">{c.claimText}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {c.devtag} · {c.verificationStatus} · {relativeTime(c.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
                {(recentQ.data ?? []).length === 0 && (
                  <li className="text-[12px] text-[var(--color-text-muted)]">No ledger activity yet</li>
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="mb-3 font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Quick commands
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Cmd
                  color="var(--color-teal)"
                  icon={Sparkles}
                  label="Extract claims"
                  onClick={() => setExtractOpen(true)}
                />
                <Cmd
                  color="var(--color-amber)"
                  icon={Search}
                  label={batchMut.isPending ? "Verifying…" : `Verify pending (${Math.min(3, pendingCount)})`}
                  disabled={pendingCount === 0 || batchMut.isPending}
                  onClick={() => batchMut.mutate({ scriptId, limit: 3 })}
                />
                <Cmd
                  color="var(--color-text-muted)"
                  icon={RefreshCw}
                  label="Refresh data"
                  onClick={() => {
                    summaryQ.refetch();
                    recentQ.refetch();
                  }}
                />
                <Cmd
                  color="var(--color-coral)"
                  icon={AlertTriangle}
                  label="Show rejected"
                  onClick={() => setStatusFilter("rejected")}
                />
              </div>
              {batchMut.isError && (
                <p className="mt-2 text-[11px] text-[var(--color-coral)]">{batchMut.error.message}</p>
              )}
              {batchMut.isSuccess && (
                <p className="mt-2 text-[11px] text-[var(--color-teal)]">
                  Batch finished · {batchMut.data.verified} claim(s) processed
                </p>
              )}
            </section>

            {extractOpen && (
              <section className="rounded-2xl border border-[var(--color-teal)]/40 bg-[var(--color-surface)] p-4">
                <p className="mb-2 font-[var(--font-display)] text-[11px] uppercase tracking-widest text-[var(--color-teal)]">
                  Extract & log claims
                </p>
                {!scripts?.length ? (
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    Create a script in Script Studio first.
                  </p>
                ) : (
                  <>
                    <select
                      value={extractScriptId}
                      onChange={(e) => setExtractScriptId(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[13px]"
                    >
                      {scripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={extractText}
                      onChange={(e) => setExtractText(e.target.value)}
                      rows={4}
                      placeholder="Paste script or description text to extract factual claims…"
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={extractMut.isPending || extractText.trim().length === 0 || !extractScriptId}
                        onClick={() =>
                          extractMut.mutate({ scriptId: extractScriptId, text: extractText.trim() })
                        }
                        className="btn-vibe-primary px-3 py-1.5 text-[12px]"
                      >
                        {extractMut.isPending ? "Extracting…" : "Run extractor"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtractOpen(false)}
                        className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                    {extractMut.isError && (
                      <p className="mt-2 text-[11px] text-[var(--color-coral)]">{extractMut.error.message}</p>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-[100px]">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="font-[var(--font-display)] text-lg text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function Vital({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <li className="flex items-center justify-between border-b border-[var(--color-line)]/60 pb-2">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-[var(--font-display)]" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </li>
  );
}

function Cmd({
  label,
  icon: Icon,
  color,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Search;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-3 text-left transition hover:border-[var(--color-text-muted)]/50 disabled:opacity-40"
    >
      <Icon size={16} style={{ color }} />
      <span className="text-[12px] text-[var(--color-text-primary)]">{label}</span>
    </button>
  );
}
