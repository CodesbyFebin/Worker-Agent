import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { ModelChooser } from "../../components/ModelChooser";
import { GodMachineChatDock } from "../god-machine/GodMachineChatDock";
import type { AgentTaskStatus } from "../../../../shared/types";

const PIPELINE = [
  "Brief",
  "Script",
  "Claim Evidence",
  "Storyboard",
  "Voice & Captions",
  "Render",
  "Approval",
  "Schedule",
  "Publish",
] as const;

const FORMATS = [
  { id: "short", label: "Vertical Short" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
  { id: "long", label: "Long-form Video" },
] as const;

function roleToPipelineIndex(role: string): number {
  const map: Record<string, number> = {
    planner: 0,
    researcher: 0,
    writer: 1,
    reviewer: 2,
    video_generator: 3,
    voiceover: 4,
    caption_hashtag: 4,
    seo: 4,
    video_editor: 5,
    publisher: 6,
  };
  return map[role] ?? 0;
}

function dayStatusLabel(stages: Array<{ status: string; agentRole: string }>): {
  label: string;
  tone: string;
} {
  if (stages.some((s) => s.status === "awaiting_approval")) {
    return { label: "Ready", tone: "text-[var(--color-teal)]" };
  }
  if (stages.some((s) => s.status === "running" || s.status === "assigned")) {
    const r = stages.find((s) => s.status === "running" || s.status === "assigned");
    if (r?.agentRole.includes("video") || r?.agentRole === "video_editor") {
      return { label: "Rendering", tone: "text-[var(--color-amber)]" };
    }
    if (r?.agentRole === "writer") return { label: "Script generated", tone: "text-[var(--color-violet)]" };
    return { label: "In progress", tone: "text-[var(--color-amber)]" };
  }
  if (stages.every((s) => s.status === "completed") && stages.length) {
    return { label: "Published / done", tone: "text-[var(--color-teal)]" };
  }
  if (stages.some((s) => s.status === "failed" || s.status === "blocked")) {
    return { label: "Needs attention", tone: "text-[var(--color-coral)]" };
  }
  if (stages.some((s) => s.agentRole === "writer" && s.status === "completed")) {
    return { label: "Script generated", tone: "text-[var(--color-violet)]" };
  }
  return { label: "Queued", tone: "text-[var(--color-text-muted)]" };
}

function stageProgress(stages: Array<{ status: string; agentRole: string; order: number }>) {
  const steps = [
    { key: "brief", roles: ["planner", "researcher"] },
    { key: "script", roles: ["writer"] },
    { key: "evidence", roles: ["reviewer"] },
    { key: "render", roles: ["video_generator", "video_editor", "voiceover"] },
    { key: "schedule", roles: ["publisher"] },
  ];
  return steps.map((step) => {
    const matched = stages.filter((s) => step.roles.includes(s.agentRole));
    if (!matched.length) return "pending" as const;
    if (matched.some((s) => s.status === "running" || s.status === "assigned")) return "active" as const;
    if (matched.every((s) => s.status === "completed" || s.status === "awaiting_approval")) {
      return "done" as const;
    }
    if (matched.some((s) => s.status === "failed" || s.status === "blocked")) return "fail" as const;
    return "pending" as const;
  });
}

/**
 * AI Video Autopilot — YouTube Auto page matching WorkerAgent reference.
 * Real campaign / ledger / connectors / events only. God Machine chat dock embedded.
 */
export function VideoAutopilotWorkspace() {
  const utils = trpc.useUtils();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [recipe, setRecipe] = useState({
    contentSource: "Topic queue",
    topicQueue: "Weekly Content Engine",
    audience: "General YouTube Shorts viewers",
    format: "short" as (typeof FORMATS)[number]["id"],
    duration: "30–60 sec",
    brandVoice: "Clear, Confident, Helpful",
    visualStyle: "Clean Modern",
    voiceover: true,
    captions: true,
    cta: "Learn more",
    sourceRequirements: "Cite evidence",
    variants: 3,
    topic: "",
    totalDays: 7,
  });

  const [autopost, setAutopost] = useState({
    enabled: false,
    mode: "manual" as "manual" | "templates" | "scheduled",
    quietStart: "22:00",
    quietEnd: "07:00",
    duplicatePrevention: true,
    blockClaimConflict: true,
    blockSensitive: true,
  });

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

  const { data: ledgerSummary } = trpc.ledger.summary.useQuery(undefined, { refetchInterval: 10_000 });
  const { data: connectors } = trpc.connectors.list.useQuery();
  const { data: events } = trpc.ide.listRecentEvents.useQuery({ limit: 12 }, { refetchInterval: 5000 });
  const ytConfigured = connectors?.connectors.find((c) => c.id === "youtube")?.configured ?? false;

  useEffect(() => {
    if (campaign?.topic && !recipe.topic) {
      setRecipe((r) => ({ ...r, topic: campaign.topic }));
    }
  }, [campaign?.topic, recipe.topic]);

  const start = trpc.campaign.start.useMutation({
    onSuccess: (r) => {
      setCampaignId(r.campaignId);
      utils.campaign.list.invalidate();
      setActionMsg("Autopilot campaign started — days enqueue via BullMQ");
    },
    onError: (e) => setActionMsg(e.message),
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
    onSuccess: () => utils.campaign.getDays.invalidate(),
  });
  const retryStage = trpc.campaign.retryStage.useMutation({
    onSuccess: () => utils.campaign.getDays.invalidate(),
  });

  const queueDays = useMemo(() => (days ?? []).slice(0, 8), [days]);

  const pipelineHighlight = useMemo(() => {
    const all = (days ?? []).flatMap((d) => d.stages);
    const active = all.find((s) => s.status === "running" || s.status === "awaiting_approval");
    if (!active) return { evidence: false, approval: false };
    const idx = roleToPipelineIndex(active.agentRole);
    return {
      evidence: idx === 2 || active.agentRole === "reviewer",
      approval: active.status === "awaiting_approval" || active.agentRole === "publisher",
    };
  }, [days]);

  const publishingQueue = useMemo(() => {
    return (days ?? [])
      .map((d) => {
        const pub = d.stages.find((s) => s.agentRole === "publisher");
        return {
          id: d.day.id,
          title: d.day.title,
          status: pub?.status ?? d.day.status,
          scheduledAt: pub?.scheduledAt ?? null,
          awaiting: pub?.status === "awaiting_approval",
        };
      })
      .filter((p) => p.status !== "pending" || p.awaiting)
      .slice(0, 6);
  }, [days]);

  const calendarSlots = useMemo(() => {
    const startDate = campaign?.startDate ? new Date(campaign.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const day = (days ?? []).find((x) => x.day.dayIndex === i);
      const pub = day?.stages.find((s) => s.agentRole === "publisher");
      let tone = "bg-[var(--color-ink)] text-[var(--color-text-muted)]";
      let label = "—";
      if (pub?.status === "awaiting_approval") {
        tone = "bg-[var(--color-amber)]/20 text-[var(--color-amber)]";
        label = "Awaiting approval";
      } else if (pub?.status === "completed") {
        tone = "bg-[var(--color-teal)]/20 text-[var(--color-teal)]";
        label = "Published";
      } else if (pub?.scheduledAt) {
        tone = "bg-[var(--color-violet)]/20 text-[var(--color-violet)]";
        label = "Scheduled";
      } else if (day) {
        tone = "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]";
        label = "In review";
      }
      return {
        key: i,
        name: d.toLocaleDateString(undefined, { weekday: "short" }),
        date: d.getDate(),
        tone,
        label,
        time: pub?.scheduledAt
          ? new Date(pub.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          : i % 2 === 0
            ? "9 AM"
            : "12 PM",
      };
    });
  }, [campaign?.startDate, days]);

  const contextHint = useMemo(() => {
    const parts = [
      campaign ? `Campaign: ${campaign.topic} (${campaign.status})` : "No campaign selected",
      `Format: ${recipe.format}, voice=${recipe.brandVoice}`,
      ledgerSummary
        ? `Ledger: ${ledgerSummary.byStatus.pending ?? 0} pending / ${ledgerSummary.byStatus.verified ?? 0} verified / ${ledgerSummary.byStatus.rejected ?? 0} rejected`
        : null,
      ytConfigured ? "YouTube connector: on" : "YouTube connector: off",
    ];
    return parts.filter(Boolean).join("\n");
  }, [campaign, recipe.format, recipe.brandVoice, ledgerSummary, ytConfigured]);

  const conflictCount = ledgerSummary?.byStatus.rejected ?? 0;
  const autopilotReady = Boolean(campaign) && ytConfigured;

  function generatePreview() {
    const topic = recipe.topic.trim() || campaign?.topic;
    if (!topic) {
      setActionMsg("Set a topic in the recipe (or pick a campaign) before generating");
      return;
    }
    if (activeCampaignId && campaign?.status === "active") {
      setActionMsg("Campaign already running — use queue Retry / Approve on days");
      return;
    }
    start.mutate({ topic, totalDays: recipe.totalDays });
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 px-3 py-2 backdrop-blur-md">
          <p className="text-[13px] font-semibold">ContentOps Agent</p>
          <span className="text-[var(--color-text-muted)]">|</span>
          <span className="text-[12px] text-[var(--color-text-muted)]">Video Team</span>
          <select
            className="max-w-[220px] truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[12px]"
            value={activeCampaignId ?? ""}
            onChange={(e) => setCampaignId(e.target.value || null)}
          >
            <option value="">Always-On Video Engine</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.topic.slice(0, 48)} ({c.status})
              </option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ModelChooser compact />
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                autopilotReady
                  ? "border-[var(--color-teal)]/40 text-[var(--color-teal)]"
                  : "border-[var(--color-amber)]/40 text-[var(--color-amber)]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {autopilotReady ? "Autopilot configured" : "Configure connectors / campaign"}
            </span>
            <button
              type="button"
              onClick={() =>
                setActionMsg(
                  campaign
                    ? `Preview: ${campaign.topic} · ${queueDays.length} day(s) in queue`
                    : "No campaign to preview",
                )
              }
              className="btn-vibe-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              <Eye size={13} /> Run preview
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="btn-vibe-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              <Settings2 size={13} /> Review settings
            </button>
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] ${
                chatOpen
                  ? "border-[var(--color-teal)]/50 bg-[var(--color-teal)]/10 text-[var(--color-teal)]"
                  : "border-[var(--color-line)] text-[var(--color-text-muted)]"
              }`}
            >
              <MessageSquare size={13} /> God Machine
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

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3">
            <h1 className="text-vibe-brand text-2xl tracking-tight">AI Video Autopilot</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-text-muted)]">
              Configure the generation recipe, monitor the queue, and control autoposting with claim
              guardrails — wired to real campaign stages.
            </p>
          </div>

          {/* Main 3-col */}
          <div className="grid gap-3 xl:grid-cols-12">
            {/* Generation Recipe */}
            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 xl:col-span-3">
              <h2 className="text-[14px] font-semibold">Generation Recipe</h2>
              <div className="mt-3 space-y-2.5 text-[12px]">
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Content Source</span>
                  <select
                    value={recipe.contentSource}
                    onChange={(e) => setRecipe({ ...recipe, contentSource: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  >
                    <option>Topic queue</option>
                    <option>Research brief</option>
                    <option>Campaign topic</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Topic / Campaign seed</span>
                  <input
                    value={recipe.topic}
                    onChange={(e) => setRecipe({ ...recipe, topic: e.target.value })}
                    placeholder="e.g. UKG workforce tips"
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Topic Queue</span>
                  <select
                    value={recipe.topicQueue}
                    onChange={(e) => setRecipe({ ...recipe, topicQueue: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  >
                    <option>Weekly Content Engine</option>
                    <option>Weekly Short-Form Series</option>
                    <option>Always-On Video</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Audience</span>
                  <input
                    value={recipe.audience}
                    onChange={(e) => setRecipe({ ...recipe, audience: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>

                <p className="pt-1 text-[11px] text-[var(--color-text-muted)]">Video format</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRecipe({ ...recipe, format: f.id })}
                      className={`rounded-lg border px-2 py-2 text-left text-[11px] ${
                        recipe.format === f.id
                          ? "border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-[var(--color-text-primary)]"
                          : "border-[var(--color-line)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[var(--color-text-muted)]">Duration</span>
                    <input
                      value={recipe.duration}
                      onChange={(e) => setRecipe({ ...recipe, duration: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[var(--color-text-muted)]">Days</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={recipe.totalDays}
                      onChange={(e) => setRecipe({ ...recipe, totalDays: Number(e.target.value) || 7 })}
                      className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Brand Voice</span>
                  <input
                    value={recipe.brandVoice}
                    onChange={(e) => setRecipe({ ...recipe, brandVoice: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Visual Style</span>
                  <input
                    value={recipe.visualStyle}
                    onChange={(e) => setRecipe({ ...recipe, visualStyle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={recipe.voiceover}
                      onChange={(e) => setRecipe({ ...recipe, voiceover: e.target.checked })}
                    />
                    Voiceover
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={recipe.captions}
                      onChange={(e) => setRecipe({ ...recipe, captions: e.target.checked })}
                    />
                    Captions
                  </label>
                </div>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Call to Action</span>
                  <input
                    value={recipe.cta}
                    onChange={(e) => setRecipe({ ...recipe, cta: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Source Requirements</span>
                  <input
                    value={recipe.sourceRequirements}
                    onChange={(e) => setRecipe({ ...recipe, sourceRequirements: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--color-text-muted)]">Output Variants</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={recipe.variants}
                    onChange={(e) => setRecipe({ ...recipe, variants: Number(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5"
                  />
                </label>
                <button
                  type="button"
                  disabled={start.isPending}
                  onClick={generatePreview}
                  className="btn-vibe-primary mt-2 w-full py-2.5 text-[13px]"
                >
                  {start.isPending ? "Starting pipeline…" : "Generate preview"}
                </button>
                {campaign && (
                  <button
                    type="button"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate({
                        campaignId: campaign.id,
                        status: campaign.status === "paused" ? "active" : "paused",
                      })
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-line)] py-2 text-[12px]"
                  >
                    {campaign.status === "paused" ? <Play size={13} /> : <Pause size={13} />}
                    {campaign.status === "paused" ? "Resume Autopilot" : "Pause Autopilot"}
                  </button>
                )}
              </div>
            </section>

            {/* Queue + pipeline */}
            <section className="space-y-3 xl:col-span-5">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold">AI Video Generation Queue</h2>
                  <button
                    type="button"
                    onClick={() => utils.campaign.getDays.invalidate()}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <ul className="mt-3 space-y-3">
                  {queueDays.map((d) => {
                    const st = dayStatusLabel(d.stages);
                    const prog = stageProgress(d.stages);
                    const labels = ["Brief ready", "Script generated", "Evidence review", "Video rendering", "Ready to schedule"];
                    return (
                      <li key={d.day.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{d.day.title.replace(/^Day \d+:\s*/i, "") || `Day ${(d.day.dayIndex ?? 0) + 1}`}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              Day {(d.day.dayIndex ?? 0) + 1} · {d.stages.filter((s) => s.status === "completed").length}/
                              {d.stages.length} stages
                            </p>
                          </div>
                          <span className={`shrink-0 text-[11px] ${st.tone}`}>{st.label}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {prog.map((p, i) => (
                            <span
                              key={labels[i]}
                              title={labels[i]}
                              className={`rounded px-1.5 py-0.5 text-[9px] ${
                                p === "done"
                                  ? "bg-[var(--color-teal)]/20 text-[var(--color-teal)]"
                                  : p === "active"
                                    ? "bg-[var(--color-amber)]/20 text-[var(--color-amber)]"
                                    : p === "fail"
                                      ? "bg-[var(--color-coral)]/20 text-[var(--color-coral)]"
                                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                              }`}
                            >
                              {labels[i]}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.stages
                            .filter((s) => ["failed", "blocked", "pending"].includes(s.status))
                            .slice(0, 3)
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                disabled={retryStage.isPending}
                                onClick={() => retryStage.mutate({ taskId: s.id })}
                                className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                              >
                                Retry {s.agentRole}
                              </button>
                            ))}
                          {d.stages.some((s) => s.status === "awaiting_approval") && (
                            <>
                              <button
                                type="button"
                                disabled={approveDay.isPending}
                                onClick={() => approveDay.mutate({ dayRootTaskId: d.day.id })}
                                className="rounded bg-[var(--color-violet)] px-2 py-0.5 text-[10px] text-white"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={rejectDay.isPending}
                                onClick={() =>
                                  rejectDay.mutate({
                                    dayRootTaskId: d.day.id,
                                    reason: "Rejected from Autopilot queue",
                                  })
                                }
                                className="rounded border border-[var(--color-coral)]/50 px-2 py-0.5 text-[10px] text-[var(--color-coral)]"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {!queueDays.length && (
                    <li className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">
                      No days in queue — set a topic and Generate preview
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <h2 className="text-[13px] font-semibold">Workflow pipeline</h2>
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {PIPELINE.map((step, i) => {
                    const hot =
                      (step === "Claim Evidence" && pipelineHighlight.evidence) ||
                      (step === "Approval" && pipelineHighlight.approval);
                    return (
                      <div key={step} className="flex items-center gap-1">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] ${
                            hot
                              ? "bg-[var(--color-violet)] text-white shadow-[var(--glow-magenta)]"
                              : "border border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-text-muted)]"
                          }`}
                        >
                          {step}
                        </span>
                        {i < PIPELINE.length - 1 && (
                          <span className="text-[var(--color-text-muted)]">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Autopost */}
            <section className="space-y-3 xl:col-span-4">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <h2 className="text-[14px] font-semibold">Autopost Controls</h2>
                <label className="mt-3 flex items-center justify-between text-[13px]">
                  Auto-post approved content
                  <input
                    type="checkbox"
                    checked={autopost.enabled}
                    onChange={(e) => setAutopost({ ...autopost, enabled: e.target.checked })}
                  />
                </label>
                <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">Posting mode</p>
                <div className="mt-1 space-y-1.5 text-[12px]">
                  {(
                    [
                      ["manual", "Manual approval"],
                      ["templates", "Approved templates"],
                      ["scheduled", "Scheduled campaign"],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="postMode"
                        checked={autopost.mode === id}
                        onChange={() => setAutopost({ ...autopost, mode: id })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-2 text-[12px]">
                  <p>
                    Channel:{" "}
                    <span className={ytConfigured ? "text-[var(--color-teal)]" : "text-[var(--color-amber)]"}>
                      YouTube {ytConfigured ? "connected" : "not configured"}
                    </span>
                  </p>
                  <p className="text-[var(--color-text-muted)]">
                    Quiet hours {autopost.quietStart} – {autopost.quietEnd} (UI preference — enforce at schedule)
                  </p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autopost.duplicatePrevention}
                      onChange={(e) => setAutopost({ ...autopost, duplicatePrevention: e.target.checked })}
                    />
                    Duplicate prevention
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autopost.blockClaimConflict}
                      onChange={(e) => setAutopost({ ...autopost, blockClaimConflict: e.target.checked })}
                    />
                    Block on claim-conflict
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autopost.blockSensitive}
                      onChange={(e) => setAutopost({ ...autopost, blockSensitive: e.target.checked })}
                    />
                    Sensitive-topic filter
                  </label>
                </div>
                {autopost.enabled && autopost.mode !== "manual" && (
                  <p className="mt-2 text-[10px] text-[var(--color-amber)]">
                    Auto-post still requires publisher <code className="font-mono">awaiting_approval</code> → Approve
                    unless you flip days manually. Full unattended publish is a known limit.
                  </p>
                )}
              </div>

              {conflictCount > 0 && autopost.blockClaimConflict && (
                <div className="rounded-xl border border-[var(--color-coral)]/50 bg-[var(--color-coral)]/10 p-3 text-[12px] text-[var(--color-coral)]">
                  {conflictCount} rejected claim(s) in ledger — publishing should stay paused until reviewed.
                </div>
              )}
              <div className="rounded-xl border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 p-3 text-[12px] text-[var(--color-teal)]">
                <p className="flex items-center gap-1.5 font-medium">
                  <Check size={13} /> Guardrails active
                </p>
                <p className="mt-1 text-[11px] opacity-90">
                  Rules enforced via Claim Ledger + publisher approval gate
                  {ledgerSummary
                    ? ` · ${ledgerSummary.byStatus.verified ?? 0} verified / ${ledgerSummary.byStatus.pending ?? 0} pending`
                    : ""}
                </p>
              </div>
            </section>
          </div>

          {/* Bottom row */}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="text-[13px] font-semibold">Content Calendar</h2>
              <div className="mt-3 grid grid-cols-7 gap-1">
                {calendarSlots.map((s) => (
                  <div key={s.key} className={`rounded-lg p-1.5 text-center ${s.tone}`}>
                    <p className="text-[9px] uppercase opacity-70">{s.name}</p>
                    <p className="text-[12px] font-semibold">{s.date}</p>
                    <p className="mt-1 text-[8px] leading-tight">{s.label}</p>
                    <p className="text-[8px] opacity-70">{s.time}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="text-[13px] font-semibold">Publishing Queue</h2>
              <ul className="mt-3 space-y-2">
                {publishingQueue.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-2 text-[12px]"
                  >
                    <span className="min-w-0 truncate">{p.title}</span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                      {p.scheduledAt
                        ? new Date(p.scheduledAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : (p.status as AgentTaskStatus)}
                    </span>
                  </li>
                ))}
                {!publishingQueue.length && (
                  <li className="text-[12px] text-[var(--color-text-muted)]">No publish stages yet</li>
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="text-[13px] font-semibold">Performance Learning</h2>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Real loop uses ledger + stage outcomes (not invented watch metrics).
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                <span className="rounded-full border border-[var(--color-line)] px-2 py-1">Watch signals*</span>
                <span className="text-[var(--color-text-muted)]">→</span>
                <span className="rounded-full border border-[var(--color-violet)]/50 px-2 py-1 text-[var(--color-violet)]">
                  Next brief
                </span>
                <span className="text-[var(--color-text-muted)]">→</span>
                <span className="rounded-full border border-[var(--color-line)] px-2 py-1">New variant</span>
                <span className="text-[var(--color-text-muted)]">→</span>
                <span className="rounded-full border border-[var(--color-teal)]/50 px-2 py-1 text-[var(--color-teal)]">
                  Audience Qs
                </span>
              </div>
              <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
                *YouTube Analytics API not connected — use God Machine Codex to draft the next brief from
                verified claims ({ledgerSummary?.byStatus.verified ?? 0}).
              </p>
            </section>
          </div>

          {/* Activity log */}
          <section className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <h2 className="px-1 text-[12px] font-semibold">Activity log</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(events ?? []).map((e) => (
                <div
                  key={e.id}
                  className="min-w-[160px] shrink-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-2"
                >
                  <p className="font-[var(--font-mono)] text-[9px] uppercase text-[var(--color-violet)]">
                    {e.eventType}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px]">{e.message}</p>
                  <p className="mt-1 text-[9px] text-[var(--color-text-muted)]">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              {!events?.length && (
                <p className="px-1 text-[12px] text-[var(--color-text-muted)]">No agent events yet</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {chatOpen && (
        <aside className="flex w-full max-w-md shrink-0 flex-col sm:w-[380px]">
          <GodMachineChatDock contextHint={contextHint} onClose={() => setChatOpen(false)} />
        </aside>
      )}
    </div>
  );
}
