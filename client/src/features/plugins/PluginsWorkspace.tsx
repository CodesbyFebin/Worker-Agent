import { useState } from "react";
import { CheckCircle2, AlertTriangle, Plug, Shield, Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

const STATUS_STYLE: Record<string, string> = {
  connected: "text-[var(--color-teal)] border-[var(--color-teal)]",
  needs_attention: "text-[var(--color-amber)] border-[var(--color-amber)]",
  available: "text-[var(--color-teal)]/80 border-[var(--color-line)]",
  approval_required: "text-[var(--color-violet)] border-[var(--color-violet)]",
};

/**
 * Plugins & Connectors — real env-backed connector status (no secret values).
 */
export function PluginsWorkspace({ mode = "plugins" }: { mode?: "plugins" | "credentials" }) {
  const { data, isLoading, isError, error, refetch } = trpc.connectors.list.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const [filter, setFilter] = useState<"all" | "llm" | "search" | "publishing" | "devtools">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const connectors = (data?.connectors ?? []).filter((c) => filter === "all" || c.category === filter);
  const selected = connectors.find((c) => c.id === selectedId) ?? connectors[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title={mode === "credentials" ? "Credentials" : "Plugins & Connectors"}
        status={`${data?.summary.connected ?? 0} connected`}
        statusTone="teal"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full bg-[var(--color-violet)] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[var(--glow-magenta)]"
          >
            + Add custom connector
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Connected" value={data?.summary.connected ?? "…"} tone="var(--color-teal)" />
          <Stat label="Needs attention" value={data?.summary.needsAttention ?? "…"} tone="var(--color-amber)" />
          <Stat label="Available" value={data?.summary.available ?? "…"} tone="var(--color-teal)" />
          <Stat label="Approval required" value={data?.summary.approvalRequired ?? 0} tone="var(--color-violet)" />
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {(["all", "llm", "search", "publishing", "devtools"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] capitalize ${
                filter === f
                  ? "bg-[var(--color-violet)]/20 text-[var(--color-violet)] ring-1 ring-[var(--color-violet)]/40"
                  : "border border-[var(--color-line)] text-[var(--color-text-muted)]"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {isLoading && (
          <p className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
            <Loader2 size={14} className="animate-spin" /> Loading connectors…
          </p>
        )}
        {isError && <p className="text-[13px] text-[var(--color-coral)]">{error.message}</p>}

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {connectors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`rounded-2xl border bg-[var(--color-surface)] p-3 text-left transition ${
                  selected?.id === c.id
                    ? "border-[var(--color-violet)] shadow-[var(--glow-magenta)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-text-muted)]/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Plug size={16} className="text-[var(--color-violet)]" />
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_STYLE[c.status]}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-medium">{c.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{c.description}</p>
                <p className="mt-2 text-[10px] font-[var(--font-mono)] text-[var(--color-text-muted)]">
                  {c.configured ? "Env set" : "Set keys in .env"}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <aside className="space-y-3">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <p className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Connector details
                </p>
                <h3 className="mt-2 text-[15px] font-semibold">{selected.name}</h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{selected.description}</p>
                <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                  Category: {selected.category} · LLM provider mode: {data?.llmProvider}
                </p>
                <p className="mt-2 font-[var(--font-mono)] text-[10px] text-[var(--color-amber)]">
                  Env: {selected.envKeys.join(", ")}
                </p>
                <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                  Secrets never leave the server — this UI only shows configured / missing.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded border px-2 py-1 text-[11px] ${STATUS_STYLE[selected.status]}`}>
                    {selected.configured ? "Connected / ready" : "Not configured"}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  <Shield size={12} /> Permission safety
                </p>
                <ul className="space-y-2 text-[12px]">
                  <li className="flex items-center gap-2 text-[var(--color-teal)]">
                    <CheckCircle2 size={14} /> Approved scopes = env present
                  </li>
                  <li className="flex items-center gap-2 text-[var(--color-amber)]">
                    <AlertTriangle size={14} /> Needs attention = partial config
                  </li>
                  <li className="flex items-center gap-2 text-[var(--color-coral)]">
                    Restricted = known platform limits (see Learn)
                  </li>
                </ul>
              </div>
            </aside>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "REST API", d: "Wire a custom OpenAI-compatible base via env" },
            { t: "Webhook", d: "Outbound events via SSE /events (no auth yet)" },
            { t: "MCP Server", d: "Cursor MCP — configure outside this app" },
            { t: "Custom OAuth", d: "Token refresh out of scope — static tokens in .env" },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-3">
              <p className="text-[12px] font-medium text-[var(--color-violet)]">{x.t}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="font-[var(--font-display)] text-2xl" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}
