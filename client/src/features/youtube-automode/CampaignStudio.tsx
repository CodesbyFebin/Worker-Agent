import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { AgentTaskStatus } from "../../../../shared/types";

const STATUS_STYLES: Record<AgentTaskStatus, string> = {
  pending: "text-[var(--color-text-muted)] border-[var(--color-line)]",
  assigned: "text-[var(--color-violet)]/70 border-[var(--color-violet)]/70",
  running: "text-[var(--color-amber)] border-[var(--color-amber)] animate-pulse",
  awaiting_approval: "text-[var(--color-violet)] border-[var(--color-violet)]",
  blocked: "text-[var(--color-coral)]/70 border-[var(--color-coral)]/70",
  completed: "text-[var(--color-teal)] border-[var(--color-teal)]",
  failed: "text-[var(--color-coral)] border-[var(--color-coral)]",
};

export function CampaignLauncher({ onStarted }: { onStarted: (campaignId: string) => void }) {
  const [topic, setTopic] = useState("");
  const [totalDays, setTotalDays] = useState(30);

  const start = trpc.campaign.start.useMutation({
    onSuccess: (result) => onStarted(result.campaignId),
  });

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-medium text-[var(--color-text-primary)]">YouTube AutoMode</h2>
      <p className="text-xs text-[var(--color-text-muted)]">
        One topic in — a full daily pipeline out: research, script, video, voiceover, edit,
        captions + hashtags, SEO, review, then held for your approval before scheduling.
      </p>
      <div className="flex gap-2 pt-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Beginner home workouts with no equipment"
          className="flex-1 rounded border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
        <input
          type="number"
          min={1}
          max={90}
          value={totalDays}
          onChange={(e) => setTotalDays(Number(e.target.value))}
          className="w-20 rounded border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-2 py-2 text-sm text-[var(--color-text-primary)]"
        />
        <button
          type="button"
          disabled={start.isPending || topic.trim().length === 0}
          onClick={() => start.mutate({ topic: topic.trim(), totalDays })}
          className="shrink-0 rounded bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
        >
          {start.isPending ? "Planning…" : `Start ${totalDays}-day campaign`}
        </button>
      </div>
      {start.isError && <p className="text-xs text-[var(--color-coral)]">{start.error.message}</p>}
    </div>
  );
}

export function CampaignMonitor({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const { data: days, isLoading, isError, error } = trpc.campaign.getDays.useQuery(
    { campaignId },
    { refetchInterval: 5000 },
  );

  const approveDay = trpc.campaign.approveDay.useMutation({
    onSuccess: () => utils.campaign.getDays.invalidate({ campaignId }),
  });

  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading campaign…</p>;
  if (isError) return <p className="text-sm text-[var(--color-coral)]">Couldn't load campaign: {error.message}</p>;
  if (!days?.length) return <p className="text-sm text-[var(--color-text-muted)]">Planning daily subtopics…</p>;

  return (
    <div className="space-y-3">
      {days.map(({ day, stages }) => (
        <div key={day.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-primary)]">{day.title}</p>
            <div className="flex items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLES[day.status as AgentTaskStatus]}`}>
                {day.status}
              </span>
              {day.status === "awaiting_approval" && (
                <button
                  type="button"
                  disabled={approveDay.isPending}
                  onClick={() => approveDay.mutate({ dayRootTaskId: day.id })}
                  className="rounded bg-[var(--color-teal)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Approve &amp; schedule
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {stages.map((stage) => (
              <span
                key={stage.id}
                title={stage.errorMessage ?? undefined}
                className={`rounded border px-2 py-0.5 text-[11px] ${STATUS_STYLES[stage.status as AgentTaskStatus]}`}
              >
                {stage.agentRole}
              </span>
            ))}
          </div>

          {(() => {
            const totalCost = stages.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
            const totalTokens = stages.reduce((sum, s) => sum + (s.inputTokens ?? 0) + (s.outputTokens ?? 0), 0);
            if (totalTokens === 0) return null;
            return (
              <p className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
                {totalTokens.toLocaleString()} tokens so far{totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ""}
              </p>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
