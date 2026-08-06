import { useState } from "react";
import { Film, Radio, BarChart3, Plus, Play } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

type Tab = "channels" | "pipeline" | "analytics";

/**
 * YouTube Automation Studio — org-scoped multi-channel factory (Phase 11).
 * Extends existing tenancy + workflow runtime; does not rebuild auth.
 */
export function YoutubeStudioWorkspace() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("channels");
  const [msg, setMsg] = useState<string | null>(null);

  const channels = trpc.youtubeStudio.listChannels.useQuery(undefined, { refetchInterval: 10_000 });
  const videos = trpc.youtubeStudio.listVideos.useQuery({ limit: 40 }, { refetchInterval: 8_000 });
  const trends = trpc.youtubeStudio.listTrends.useQuery({ limit: 15 });
  const workflows = trpc.workflow.list.useQuery();

  const [channelName, setChannelName] = useState("");
  const [accessKey, setAccessKey] = useState("YOUTUBE_ACCESS_TOKEN");
  const [ytChannelId, setYtChannelId] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [topic, setTopic] = useState("Future of Quantum Computing");
  const [trendQuery, setTrendQuery] = useState("AI automation 2026");
  const [selectedWf, setSelectedWf] = useState<string>("");

  const upsert = trpc.youtubeStudio.upsertChannel.useMutation({
    onSuccess: () => {
      setMsg("Channel binding saved (OAuth via env key — no raw tokens in DB)");
      void utils.youtubeStudio.listChannels.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const ensure = trpc.youtubeStudio.ensureScriptwriter.useMutation({
    onSuccess: (r) => setMsg(`Scriptwriter ready · ${r.agentId.slice(0, 8)}…`),
    onError: (e) => setMsg(e.message),
  });
  const seed = trpc.youtubeStudio.seedLongFormWorkflow.useMutation({
    onSuccess: (r) => {
      setMsg(`Seeded long-form workflow ${r.workflowId.slice(0, 8)}…`);
      setSelectedWf(r.workflowId);
      void utils.workflow.list.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const batch = trpc.youtubeStudio.batchPublish.useMutation({
    onSuccess: (r) => setMsg(`Queued ${r.runs.length} staggered run(s)`),
    onError: (e) => setMsg(e.message),
  });
  const search = trpc.youtubeStudio.searchTrends.useMutation({
    onSuccess: () => {
      setMsg("Trends stored");
      void utils.youtubeStudio.listTrends.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const genScript = trpc.youtubeStudio.generateScript.useMutation({
    onSuccess: (r) => setMsg(`Script draft: ${String(r.title ?? "ok").slice(0, 80)}`),
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="YouTube Studio"
        status={
          channels.data?.length
            ? `${channels.data.length} channel binding(s) · white-hat factory`
            : "Bind a channel to start"
        }
        statusTone="violet"
      />
      <div className="flex gap-2 border-b border-[var(--color-line)] px-4 py-2">
        {(
          [
            ["channels", "Channels", Radio],
            ["pipeline", "Pipeline", Film],
            ["analytics", "Analytics", BarChart3],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] ${
              tab === id
                ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)]"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {msg && (
          <p className="mb-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]">
            {msg}
          </p>
        )}

        {tab === "channels" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Bind channel (1 org = 1 factory tenant)
              </p>
              <div className="mt-3 space-y-2">
                <Field label="Display name" value={channelName} onChange={setChannelName} />
                <Field label="YouTube channel id (UC…)" value={ytChannelId} onChange={setYtChannelId} />
                <Field
                  label="Access token env key"
                  value={accessKey}
                  onChange={setAccessKey}
                />
                <Field label="Timezone" value={timezone} onChange={setTimezone} />
                <button
                  type="button"
                  disabled={!channelName || upsert.isPending}
                  onClick={() =>
                    upsert.mutate({
                      channelName,
                      youtubeChannelId: ytChannelId || undefined,
                      accessTokenEnvKey: accessKey,
                      timezone,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-violet)]/90 px-3 py-1.5 text-[12px] text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Save binding
                </button>
              </div>
              <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                Tokens stay in <code>.env</code> (e.g. <code>YOUTUBE_ACCESS_TOKEN_CH01</code>). Distinct
                user-agents are assigned per channel for anti-fingerprinting.
              </p>
            </section>
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Bound channels
              </p>
              <ul className="mt-2 space-y-2">
                {(channels.data ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]"
                  >
                    <p className="font-medium">{c.channelName}</p>
                    <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                      env={c.accessTokenEnvKey} · tz={c.timezone} ·{" "}
                      {c.isActive ? "active" : "off"}
                    </p>
                  </li>
                ))}
                {!channels.data?.length && (
                  <li className="text-[12px] text-[var(--color-text-muted)]">No channels yet</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {tab === "pipeline" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Long-form pipeline
              </p>
              <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                Seeds Automations with Script → Sanity Shield → Voice / B-roll → Assemble → Upload.
                Open <strong>Automations</strong> for the React Flow canvas (YouTube node palette).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => ensure.mutate()}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
                >
                  Ensure Scriptwriter agent
                </button>
                <button
                  type="button"
                  onClick={() => seed.mutate({ name: "YouTube Long Form" })}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
                >
                  Seed long-form template
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <Field label="Topic" value={topic} onChange={setTopic} />
                <button
                  type="button"
                  onClick={() => genScript.mutate({ topic, lengthMinutes: 10 })}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
                >
                  Draft script only
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <label className="text-[10px] uppercase text-[var(--color-text-muted)]">Workflow</label>
                <select
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  value={selectedWf}
                  onChange={(e) => setSelectedWf(e.target.value)}
                >
                  <option value="">Select workflow…</option>
                  {(workflows.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedWf || batch.isPending}
                  onClick={() =>
                    batch.mutate({
                      workflowDefinitionId: selectedWf,
                      topics: [topic],
                      staggerMinutes: 0,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)]/90 px-3 py-1.5 text-[12px] text-[var(--color-ink)]"
                >
                  <Play className="h-3.5 w-3.5" /> Publish run
                </button>
              </div>
            </section>
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Recent videos
              </p>
              <ul className="mt-2 space-y-2">
                {(videos.data ?? []).map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]"
                  >
                    <div className="flex justify-between gap-2">
                      <span>{v.title}</span>
                      <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-amber)]">
                        {v.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      views {v.views}
                      {v.youtubeVideoId ? ` · ${v.youtubeVideoId}` : ""}
                    </p>
                  </li>
                ))}
                {!videos.data?.length && (
                  <li className="text-[12px] text-[var(--color-text-muted)]">No video rows yet</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {tab === "analytics" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Trend search (Data API)
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  value={trendQuery}
                  onChange={(e) => setTrendQuery(e.target.value)}
                />
                <button
                  type="button"
                  disabled={search.isPending}
                  onClick={() => search.mutate({ query: trendQuery })}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
                >
                  Search
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Requires <code>YOUTUBE_API_KEY</code>. Analytics worker runs every 6h and may append pacing
                hints to the Scriptwriter when stored avg view duration &lt; 60% on ≥3 videos.
              </p>
            </section>
            <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Stored trends
              </p>
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                {(trends.data ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[12px]"
                  >
                    <p className="font-medium">{t.query}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(t.fetchedAt).toLocaleString()} · {t.source}
                    </p>
                  </li>
                ))}
                {!trends.data?.length && (
                  <li className="text-[12px] text-[var(--color-text-muted)]">No trends yet</li>
                )}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{label}</span>
      <input
        className="mt-0.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
