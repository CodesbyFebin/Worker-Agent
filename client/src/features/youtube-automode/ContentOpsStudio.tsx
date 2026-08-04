import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Eye,
  Pause,
  Play,
  Redo2,
  SkipBack,
  SkipForward,
  Undo2,
  Volume2,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import type { AgentTaskStatus, ClaimVerificationStatus } from "../../../../shared/types";

export type ContentOpsFocus =
  | "studio"
  | "research"
  | "approvals"
  | "publishing"
  | "youtube";

const SCENE_COLORS = [
  "var(--color-violet)",
  "#3b82f6",
  "var(--color-teal)",
  "var(--color-amber)",
  "var(--color-coral)",
] as const;

const SCENE_LABELS = ["Hook", "Problem", "Insight", "Evidence", "CTA"] as const;

const OUTPUT_FORMATS = [
  { id: "short", label: "Vertical Short 9:16", hint: "YouTube Shorts" },
  { id: "reel", label: "Reel 4:5", hint: "Instagram / TikTok-friendly" },
  { id: "story", label: "Story 9:16", hint: "Ephemeral story crop" },
] as const;

function stageText(result: unknown, keys: string[]): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function claimBadge(status: ClaimVerificationStatus): { label: string; color: string } {
  switch (status) {
    case "verified":
      return { label: "Supported", color: "var(--color-teal)" };
    case "pending":
      return { label: "Needs review", color: "var(--color-amber)" };
    case "rejected":
      return { label: "Conflicting evidence", color: "var(--color-coral)" };
    case "unverifiable":
      return { label: "Unverifiable", color: "var(--color-text-muted)" };
  }
}

/**
 * ContentOps Shorts & Reels studio — layout from the WorkerAgent reference.
 * Data from real campaign / ledger / stage results only. Analytics footer
 * shows production signals (not invented YouTube watch metrics).
 */
export function ContentOpsStudio({ focus = "studio" }: { focus?: ContentOpsFocus }) {
  const utils = trpc.useUtils();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [brief, setBrief] = useState({
    topic: "",
    audience: "General YouTube Shorts viewers",
    goal: "Watch time + trust before publish",
    format: "Vertical Short 9:16",
    duration: "0:40",
    brandVoice: "Clear, confident, evidence-led",
    hookStyle: "Pattern interrupt + promise",
    cta: "Follow for the next episode",
    sourceRequirements: "Cite checkable claims; prefer primary sources",
  });
  const [safeGuides, setSafeGuides] = useState({ title: true, action: true, caption: true });
  const [safety, setSafety] = useState({
    stats: true,
    quotes: true,
    sensitive: true,
    humanReview: true,
  });
  const [outputFormat, setOutputFormat] = useState<(typeof OUTPUT_FORMATS)[number]["id"]>("short");
  const [rejectReason, setRejectReason] = useState("");
  const [captionOn, setCaptionOn] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [playhead, setPlayhead] = useState(15);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const { data: campaigns } = trpc.campaign.list.useQuery(undefined, { refetchInterval: 6000 });
  const activeCampaignId = campaignId ?? campaigns?.[0]?.id ?? null;

  const { data: campaign } = trpc.campaign.getById.useQuery(
    { campaignId: activeCampaignId! },
    { enabled: Boolean(activeCampaignId), refetchInterval: 5000 },
  );

  const { data: days } = trpc.campaign.getDays.useQuery(
    { campaignId: activeCampaignId! },
    { enabled: Boolean(activeCampaignId), refetchInterval: 4000 },
  );

  const activeDay = useMemo(() => {
    if (!days?.length) return null;
    const pick = dayId ? days.find((d) => d.day.id === dayId) : null;
    if (focus === "approvals") {
      return (
        days.find((d) => d.stages.some((s) => s.status === "awaiting_approval")) ??
        pick ??
        days[0]
      );
    }
    return pick ?? days[0];
  }, [days, dayId, focus]);

  useEffect(() => {
    if (activeDay && dayId !== activeDay.day.id) setDayId(activeDay.day.id);
  }, [activeDay, dayId]);

  useEffect(() => {
    if (campaign?.topic && !brief.topic) {
      setBrief((b) => ({ ...b, topic: campaign.topic }));
    }
  }, [campaign?.topic, brief.topic]);

  const stages = activeDay?.stages ?? [];
  const writer = stages.find((s) => s.agentRole === "writer");
  const researcher = stages.find((s) => s.agentRole === "researcher");
  const captions = stages.find((s) => s.agentRole === "caption_hashtag");
  const video = stages.find((s) => s.agentRole === "video_editor") ?? stages.find((s) => s.agentRole === "video_generator");
  const voice = stages.find((s) => s.agentRole === "voiceover");
  const publisher = stages.find((s) => s.agentRole === "publisher");
  const reviewer = stages.find((s) => s.agentRole === "reviewer");

  const draft =
    stageText(writer?.result, ["draft", "script", "text"]) ??
    (typeof (writer?.payload as { instructions?: string } | undefined)?.instructions === "string"
      ? null
      : null);
  const researchSummary = stageText(researcher?.result, ["summary", "researchSummary"]);
  const captionText = stageText(captions?.result, ["caption"]);
  const videoPath =
    stageText(video?.result, ["finalVideoPath", "videoPath"]) ??
    stageText(stages.find((s) => s.agentRole === "video_generator")?.result, ["videoPath"]);

  const scenes = useMemo(() => {
    const paras = (draft ?? "")
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return SCENE_LABELS.map((label, i) => {
      const content =
        i === 0
          ? paras[0] ?? activeDay?.day.title ?? brief.hookStyle
          : i === 1
            ? researchSummary?.slice(0, 180) ?? paras[1] ?? "Problem beat — waiting on research/script"
            : i === 2
              ? paras[2] ?? paras[1] ?? "Insight beat — waiting on writer"
              : i === 3
                ? "Evidence beat — see claims panel"
                : captionText ?? brief.cta;
      const dur = [4, 7, 10, 12, 5][i];
      return {
        index: i,
        label,
        color: SCENE_COLORS[i],
        durationSec: dur,
        visual: content,
        stageStatus: (stages[i]?.status ?? "pending") as AgentTaskStatus,
      };
    });
  }, [draft, researchSummary, captionText, activeDay?.day.title, brief.hookStyle, brief.cta, stages]);

  const totalSec = scenes.reduce((a, s) => a + s.durationSec, 0);

  const scriptIdForClaims = writer?.scriptId ?? activeDay?.day.scriptId ?? null;
  const { data: claims } = trpc.ledger.listByScript.useQuery(
    { scriptId: scriptIdForClaims! },
    { enabled: Boolean(scriptIdForClaims), refetchInterval: 8000 },
  );
  const { data: recentClaims } = trpc.ledger.listRecent.useQuery(
    { limit: 8 },
    { enabled: !scriptIdForClaims, refetchInterval: 8000 },
  );
  const evidenceClaims = claims ?? recentClaims ?? [];

  const start = trpc.campaign.start.useMutation({
    onSuccess: (r) => {
      setCampaignId(r.campaignId);
      utils.campaign.list.invalidate();
      setActionMsg("Campaign started — days enqueue via BullMQ");
    },
  });
  const setStatus = trpc.campaign.setStatus.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate();
      utils.campaign.list.invalidate();
    },
  });
  const approveDay = trpc.campaign.approveDay.useMutation({
    onSuccess: () => {
      utils.campaign.getDays.invalidate();
      setActionMsg("Approved — publish job scheduled");
    },
  });
  const rejectDay = trpc.campaign.rejectDay.useMutation({
    onSuccess: () => {
      setRejectReason("");
      utils.campaign.getDays.invalidate();
    },
  });
  const retryStage = trpc.campaign.retryStage.useMutation({
    onSuccess: () => utils.campaign.getDays.invalidate(),
  });
  const extractMut = trpc.ledger.extractAndLog.useMutation({
    onSuccess: () => {
      utils.ledger.listByScript.invalidate();
      utils.ledger.listRecent.invalidate();
      setActionMsg("Claims extracted into ledger");
    },
  });
  const verifyBatch = trpc.ledger.verifyPendingBatch.useMutation({
    onSuccess: (r) => setActionMsg(`Verified ${r.verified} pending claim(s)`),
  });

  const awaiting = publisher?.status === "awaiting_approval";
  const previewHook = scenes[0]?.visual?.slice(0, 80) ?? "Build trust before you publish";

  const stageDone = stages.filter((s) => s.status === "completed").length;
  const stageTotal = Math.max(stages.length, 1);

  async function checkClaims() {
    const text = draft ?? researchSummary ?? brief.topic;
    if (!text.trim()) {
      setActionMsg("No script/research text yet to extract claims from");
      return;
    }
    if (!scriptIdForClaims) {
      setActionMsg("No scriptId on this day yet — claims extract needs a script row. Showing recent ledger instead.");
      return;
    }
    await extractMut.mutateAsync({ scriptId: scriptIdForClaims, text });
    if (safety.stats || safety.quotes) {
      await verifyBatch.mutateAsync({ scriptId: scriptIdForClaims, limit: 3 });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 px-3 py-2 backdrop-blur-md">
        <p className="text-vibe-brand mr-2 hidden text-sm sm:block">WorkerAgent</p>
        <select
          className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          value="contentops"
          onChange={() => undefined}
        >
          <option value="contentops">ContentOps Agent</option>
        </select>
        <select
          className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          value="social"
          onChange={() => undefined}
        >
          <option value="social">Workspace: Social Video Team</option>
        </select>
        <select
          className="max-w-[220px] truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          value={activeCampaignId ?? ""}
          onChange={(e) => {
            setCampaignId(e.target.value || null);
            setDayId(null);
          }}
        >
          <option value="">Campaign: none</option>
          {(campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.topic} ({c.status})
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-lg p-1.5 text-[var(--color-text-muted)]" title="Undo (UI)">
            <Undo2 size={15} />
          </button>
          <button type="button" className="rounded-lg p-1.5 text-[var(--color-text-muted)]" title="Redo (UI)">
            <Redo2 size={15} />
          </button>
          <span className="flex items-center gap-1 text-[12px] text-[var(--color-teal)]">
            <Check size={13} />
            {campaign ? campaign.status : "Idle"}
          </span>
          <button
            type="button"
            className="btn-vibe-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            onClick={() => setActionMsg(videoPath ? `Preview path: ${videoPath}` : "No rendered video path yet")}
          >
            <Eye size={14} />
            Preview
          </button>
          <button
            type="button"
            disabled={!awaiting || approveDay.isPending}
            onClick={() => activeDay && approveDay.mutate({ dayRootTaskId: activeDay.day.id })}
            className="rounded-full bg-[var(--color-violet)] px-4 py-1.5 text-[12px] font-semibold text-white shadow-[var(--glow-magenta)] disabled:opacity-40"
          >
            Request approval
          </button>
        </div>
      </header>

      {actionMsg && (
        <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-teal)]">
          {actionMsg}
          <button type="button" className="ml-2 text-[var(--color-text-muted)]" onClick={() => setActionMsg(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* New campaign strip when empty */}
      {!campaigns?.length && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
          <input
            value={brief.topic}
            onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
            placeholder="Campaign topic to start AutoMode…"
            className="min-w-[16rem] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-1.5 text-[13px]"
          />
          <button
            type="button"
            disabled={start.isPending || !brief.topic.trim()}
            onClick={() => start.mutate({ topic: brief.topic.trim(), totalDays: 7 })}
            className="btn-vibe-primary px-4 py-1.5 text-[12px]"
          >
            {start.isPending ? "Starting…" : "Start 7-day AutoMode"}
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        {/* Creative brief */}
        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <p className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Creative brief
          </p>
          {(
            [
              ["topic", "Topic"],
              ["audience", "Audience"],
              ["goal", "Goal"],
              ["format", "Format"],
              ["duration", "Duration"],
              ["brandVoice", "Brand voice"],
              ["hookStyle", "Hook style"],
              ["cta", "Call to action"],
              ["sourceRequirements", "Source requirements"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mt-2 block">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
              <input
                value={brief[key]}
                onChange={(e) => setBrief({ ...brief, [key]: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
          ))}

          <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Audience questions</p>
            <p className="mt-1 text-[11px] text-[var(--color-text-primary)]">
              {researchSummary?.slice(0, 120) ?? "Filled when researcher stage completes — not invented."}
            </p>
          </div>
          <div className="mt-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Trend / pipeline signals</p>
            <div className="mt-2 flex h-8 items-end gap-0.5">
              {stages.slice(0, 12).map((s, i) => (
                <div
                  key={s.id}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${s.status === "completed" ? 100 : s.status === "running" ? 70 : 25}%`,
                    background:
                      s.status === "completed"
                        ? "var(--color-teal)"
                        : s.status === "running"
                          ? "var(--color-amber)"
                          : "var(--color-line)",
                  }}
                  title={`${s.agentRole}: ${s.status}`}
                />
              ))}
              {!stages.length && (
                <p className="text-[11px] text-[var(--color-text-muted)]">No stage data yet</p>
              )}
            </div>
          </div>

          {days && days.length > 0 && (
            <label className="mt-3 block">
              <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Day</span>
              <select
                value={activeDay?.day.id ?? ""}
                onChange={(e) => setDayId(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              >
                {days.map((d) => (
                  <option key={d.day.id} value={d.day.id}>
                    Day {d.day.dayIndex}: {d.day.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </aside>

        {/* Center: preview + scenes + timeline */}
        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
          <div className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)]">
            {/* Phone preview */}
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
              <div className="relative aspect-[9/16] w-full max-w-[180px] overflow-hidden rounded-[1.5rem] border-2 border-[var(--color-line)] bg-gradient-to-b from-[#1a1030] to-[#0a0812] shadow-[var(--glow-magenta)]">
                {safeGuides.title && (
                  <div className="absolute inset-x-3 top-8 rounded border border-dashed border-[var(--color-teal)]/40 p-1 text-center text-[10px] text-[var(--color-teal)]">
                    Title safe
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <p className="text-center text-[13px] font-semibold leading-snug text-white drop-shadow">
                    {previewHook}
                  </p>
                </div>
                {safeGuides.caption && (
                  <div className="absolute inset-x-4 bottom-14 rounded bg-black/50 px-2 py-1 text-center text-[10px] text-white">
                    {captionText?.slice(0, 60) ?? "Captions"}
                  </div>
                )}
                {safeGuides.action && (
                  <div className="absolute bottom-4 left-1/2 h-8 w-24 -translate-x-1/2 rounded-full border border-dashed border-[var(--color-amber)]/50" />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[var(--color-text-muted)]">
                <SkipBack size={14} />
                <Play size={16} className="text-[var(--color-text-primary)]" />
                <SkipForward size={14} />
                <Volume2 size={14} />
                <span className="font-[var(--font-mono)] text-[10px]">1/{scenes.length}</span>
              </div>
              <div className="mt-2 w-full space-y-1 text-[10px]">
                <p className="uppercase text-[var(--color-text-muted)]">Safe area guides</p>
                {(["title", "action", "caption"] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between capitalize">
                    {k}
                    <input
                      type="checkbox"
                      checked={safeGuides[k]}
                      onChange={(e) => setSafeGuides({ ...safeGuides, [k]: e.target.checked })}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Scene editor */}
            <div
              className={`min-h-0 overflow-y-auto rounded-2xl border bg-[var(--color-surface)] p-3 ${
                focus === "research" ? "border-[var(--color-teal)]/50" : "border-[var(--color-line)]"
              }`}
            >
              <div className="mb-2 flex flex-wrap gap-1">
                {[
                  { label: "Refine hook", fn: () => setActionMsg("Hook text from writer draft — edit brief hook style or re-run writer stage") },
                  { label: "Improve pacing", fn: () => setActionMsg(`Scene durations total ${totalSec}s — pacing from beat template`) },
                  { label: "Generate captions", fn: () => setActionMsg(captionText ? `Captions: ${captionText.slice(0, 120)}` : "caption_hashtag stage not complete yet") },
                  { label: "Check claims", fn: () => void checkClaims() },
                  { label: "Create variants", fn: () => setActionMsg("Use Script Studio metadata generator for title variants") },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.fn}
                    className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-violet)]/50 hover:text-[var(--color-text-primary)]"
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {scenes.map((sc) => (
                  <div
                    key={sc.label}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2.5"
                    style={{ borderLeftWidth: 3, borderLeftColor: sc.color }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium">
                        <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{sc.index + 1}.</span>{" "}
                        {sc.label}
                        <span className="ml-2 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                          0:{String(sc.durationSec).padStart(2, "0")}
                        </span>
                      </p>
                      <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                        Captions
                        <input
                          type="checkbox"
                          checked={captionOn[sc.index] ?? true}
                          onChange={(e) => setCaptionOn({ ...captionOn, [sc.index]: e.target.checked })}
                        />
                      </label>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Visual direction</p>
                    <p className="text-[12px] leading-snug text-[var(--color-text-primary)]">{sc.visual}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="shrink-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
              <span className="font-[var(--font-mono)] uppercase tracking-widest">Timeline</span>
              <span>
                Playhead {Math.floor(playhead / 60)}:{String(playhead % 60).padStart(2, "0")} / 0:
                {String(totalSec).padStart(2, "0")}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={totalSec}
              value={playhead}
              onChange={(e) => setPlayhead(Number(e.target.value))}
              className="mb-2 w-full accent-[var(--color-violet)]"
            />
            <div className="space-y-1.5 font-[var(--font-mono)] text-[9px] uppercase text-[var(--color-text-muted)]">
              <Track label="Scenes">
                {scenes.map((sc) => (
                  <div
                    key={sc.label}
                    className="h-6 rounded-md px-1 leading-6 text-[10px] text-black"
                    style={{
                      flex: sc.durationSec,
                      background: sc.color,
                      opacity: sc.stageStatus === "completed" || draft ? 1 : 0.45,
                    }}
                  >
                    {sc.label}
                  </div>
                ))}
              </Track>
              <Track label="Voice">
                <div
                  className="h-5 flex-1 rounded-md"
                  style={{
                    background: `repeating-linear-gradient(90deg, var(--color-violet), var(--color-violet) 2px, transparent 2px, transparent 4px)`,
                    opacity: voice?.status === "completed" ? 0.9 : 0.25,
                  }}
                  title={voice?.status ?? "pending"}
                />
              </Track>
              <Track label="Captions">
                {scenes.map((sc) => (
                  <div
                    key={sc.label}
                    className="h-3 rounded-sm bg-[var(--color-violet)]"
                    style={{ flex: sc.durationSec, opacity: captionOn[sc.index] ? 0.8 : 0.15 }}
                  />
                ))}
              </Track>
              <Track label="Music">
                <div
                  className="h-5 flex-1 rounded-md"
                  style={{
                    background: `repeating-linear-gradient(90deg, var(--color-teal), var(--color-teal) 3px, transparent 3px, transparent 6px)`,
                    opacity: 0.35,
                  }}
                  title="Bed music — not a separate agent yet"
                />
              </Track>
            </div>
          </div>
        </section>

        {/* Right: evidence / approval / output */}
        <aside
          className={`min-h-0 space-y-2 overflow-y-auto ${
            focus === "approvals" || focus === "publishing" ? "ring-1 ring-[var(--color-violet)]/40 rounded-2xl" : ""
          }`}
        >
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <p className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              Evidence & safety
            </p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {evidenceClaims.length === 0 && (
                <li className="text-[11px] text-[var(--color-text-muted)]">
                  No claims yet — run Check claims when script text exists.
                </li>
              )}
              {evidenceClaims.slice(0, 8).map((c) => {
                const b = claimBadge(c.verificationStatus as ClaimVerificationStatus);
                return (
                  <li key={c.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
                    <p className="text-[11px] text-[var(--color-text-primary)]">{c.claimText}</p>
                    <span className="mt-1 inline-block text-[10px]" style={{ color: b.color }}>
                      {b.label}
                      {c.sourceUrl ? " · has source" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-1.5 text-[11px]">
              {(
                [
                  ["stats", "Check statistics"],
                  ["quotes", "Check quotations"],
                  ["sensitive", "Flag sensitive claims"],
                  ["humanReview", "Require human review"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between text-[var(--color-text-muted)]">
                  {label}
                  <input
                    type="checkbox"
                    checked={safety[k]}
                    onChange={(e) => setSafety({ ...safety, [k]: e.target.checked })}
                  />
                </label>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-3 ${
              awaiting
                ? "border-[var(--color-violet)] bg-[var(--color-violet)]/10"
                : "border-[var(--color-line)] bg-[var(--color-surface)]"
            }`}
          >
            <p className="text-[12px] font-medium text-[var(--color-violet)]">
              {awaiting ? "Human approval required" : "Approval gate"}
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {awaiting
                ? "Publisher stage is awaiting_approval — approve schedules YouTube publish."
                : publisher
                  ? `Publisher: ${publisher.status}`
                  : "No publisher stage yet for this day."}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!awaiting || !rejectReason.trim() || rejectDay.isPending}
                onClick={() =>
                  activeDay &&
                  rejectDay.mutate({ dayRootTaskId: activeDay.day.id, reason: rejectReason.trim() })
                }
                className="rounded-lg border border-[var(--color-coral)] px-2.5 py-1 text-[11px] text-[var(--color-coral)] disabled:opacity-40"
              >
                Request changes
              </button>
              <button
                type="button"
                disabled={!awaiting || approveDay.isPending}
                onClick={() => activeDay && approveDay.mutate({ dayRootTaskId: activeDay.day.id })}
                className="rounded-lg bg-[var(--color-teal)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] disabled:opacity-40"
              >
                Approve version
              </button>
            </div>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Change request reason"
              className="mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[11px]"
            />
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <p className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              Output formats
            </p>
            <div className="mt-2 space-y-1">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOutputFormat(f.id)}
                  className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left ${
                    outputFormat === f.id
                      ? "border-[var(--color-violet)] bg-[var(--color-violet)]/10"
                      : "border-[var(--color-line)]"
                  }`}
                >
                  <span className="text-[12px]">{f.label}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{f.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Publishing:{" "}
              <span className="text-[var(--color-text-primary)]">
                {awaiting
                  ? "Waiting for approval"
                  : publisher?.status === "completed"
                    ? "Published / scheduled job done"
                    : publisher?.status ?? "Not ready"}
              </span>
            </p>
            {campaign && (
              <div className="mt-2 flex gap-1">
                {campaign.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setStatus.mutate({ campaignId: campaign.id, status: "paused" })}
                    className="flex items-center gap-1 rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px]"
                  >
                    <Pause size={12} /> Pause
                  </button>
                )}
                {campaign.status === "paused" && (
                  <button
                    type="button"
                    onClick={() => setStatus.mutate({ campaignId: campaign.id, status: "active" })}
                    className="flex items-center gap-1 rounded-lg border border-[var(--color-teal)] px-2 py-1 text-[11px] text-[var(--color-teal)]"
                  >
                    <Play size={12} /> Resume
                  </button>
                )}
              </div>
            )}
          </div>

          {reviewer?.status === "failed" || stages.some((s) => s.status === "failed") ? (
            <div className="rounded-2xl border border-[var(--color-coral)]/40 bg-[var(--color-surface)] p-3">
              <p className="text-[11px] text-[var(--color-coral)]">Failed stages — retry</p>
              {stages
                .filter((s) => ["failed", "blocked"].includes(s.status))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={retryStage.isPending}
                    onClick={() => retryStage.mutate({ taskId: s.id })}
                    className="mt-1 block text-[11px] text-[var(--color-text-muted)] underline"
                  >
                    Retry {s.agentRole}
                  </button>
                ))}
            </div>
          ) : null}
        </aside>
      </div>

      {/* Footer analytics — production signals only */}
      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)]/90 p-2 md:grid-cols-4">
        <FooterCard title="Hook signals">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {scenes[0]?.visual?.slice(0, 90) ?? "—"}
          </p>
        </FooterCard>
        <FooterCard title="Pipeline progress">
          <p className="font-[var(--font-mono)] text-lg text-[var(--color-teal)]">
            {stageDone}/{stageTotal}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">Stages completed (not YT watch %)</p>
        </FooterCard>
        <FooterCard title="Audience / research">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {researchSummary?.slice(0, 100) ?? "Research stage pending"}
          </p>
        </FooterCard>
        <FooterCard title="Next brief">
          {(() => {
            const next = days?.find((d) => d.day.status === "pending" || d.day.status === "running");
            return (
              <p className="text-[11px] text-[var(--color-text-primary)]">
                {next ? next.day.title : "No pending day — campaign caught up"}
              </p>
            );
          })()}
        </FooterCard>
      </footer>
    </div>
  );
}

function Track({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 gap-0.5 overflow-hidden rounded-md bg-[var(--color-ink)] p-0.5">
        {children}
      </div>
    </div>
  );
}

function FooterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
      <p className="mb-1 font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {title}
      </p>
      {children}
    </div>
  );
}
