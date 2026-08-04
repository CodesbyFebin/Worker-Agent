import { useState } from "react";
import { RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

/**
 * Ops Recovery — durable dead-letter queue for exhausted BullMQ jobs (Phase 10).
 */
export function RecoveryWorkspace() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<"open" | "retried" | "discarded" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);

  const counts = trpc.ops.dlqCounts.useQuery(undefined, { refetchInterval: 8_000 });
  const metrics = trpc.ops.metrics.useQuery(undefined, { refetchInterval: 15_000 });
  const list = trpc.ops.listDlq.useQuery(
    { status: status === "all" ? undefined : status, limit: 50 },
    { refetchInterval: 5_000 },
  );

  const retry = trpc.ops.retryDlq.useMutation({
    onSuccess: (r) => {
      setMsg(`Re-queued as job ${r.jobId}`);
      void utils.ops.listDlq.invalidate();
      void utils.ops.dlqCounts.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const discard = trpc.ops.discardDlq.useMutation({
    onSuccess: () => {
      setMsg("Discarded");
      void utils.ops.listDlq.invalidate();
      void utils.ops.dlqCounts.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Recovery"
        status={
          counts.data
            ? `${counts.data.open} open · ${counts.data.retried} retried · ${counts.data.discarded} discarded`
            : "Dead-letter queue"
        }
        statusTone="amber"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {msg && (
          <p className="mb-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]">
            {msg}
          </p>
        )}

        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <Stat label="Open DLQ" value={String(counts.data?.open ?? "—")} />
          <Stat
            label="API uptime"
            value={metrics.data ? `${metrics.data.process.uptimeSec}s` : "—"}
          />
          <Stat
            label="Queues"
            value={
              metrics.data
                ? Object.entries(metrics.data.queues)
                    .map(([n, c]) => `${n.split("-")[0]}:${c.waiting ?? 0}`)
                    .join(" · ")
                : "—"
            }
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {(["open", "retried", "discarded", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 font-[var(--font-mono)] text-[11px] uppercase tracking-wide ${
                status === s
                  ? "bg-[var(--color-amber)]/20 text-[var(--color-amber)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <ul className="space-y-2">
          {(list.data ?? []).map((job) => (
            <li
              key={job.id}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-amber)]" />
                    <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-violet)]">
                      {job.queueName}
                      {job.jobName ? ` / ${job.jobName}` : ""}
                    </span>
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--color-text)]">{job.errorMessage}</p>
                  <p className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                    attempts {job.attemptsMade} · {new Date(job.createdAt).toLocaleString()}
                    {job.organizationId ? "" : " · system (no org)"}
                  </p>
                  <pre className="mt-2 max-h-24 overflow-auto rounded bg-[var(--color-ink)] p-2 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                    {job.payload.slice(0, 800)}
                  </pre>
                </div>
                {job.status === "open" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate({ deadLetterId: job.id })}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-1.5 text-[11px]"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry
                    </button>
                    <button
                      type="button"
                      disabled={discard.isPending}
                      onClick={() => discard.mutate({ deadLetterId: job.id })}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-1.5 text-[11px] text-[var(--color-coral)]"
                    >
                      <Trash2 className="h-3 w-3" /> Discard
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!list.data?.length && !list.isLoading && (
            <li className="text-[12px] text-[var(--color-text-muted)]">No dead-letter jobs</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
      <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-[12px]">{value}</p>
    </div>
  );
}
