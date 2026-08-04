import { useMemo, useState } from "react";
import { Check, ChevronDown, Plug, Sparkles } from "lucide-react";
import { trpc } from "../lib/trpc";

/**
 * App-wide LLM mode + OpenRouter free + NVIDIA NIM model picker.
 * Writes to server runtime prefs — every complete() call uses the selection.
 */
export function ModelChooser({ compact = false }: { compact?: boolean }) {
  const utils = trpc.useUtils();
  const { data } = trpc.settings.getLlm.useQuery(undefined, { refetchInterval: 20_000 });
  const { data: orFree } = trpc.settings.listOpenRouterFree.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: nvidia } = trpc.settings.listNvidiaModels.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: connectors } = trpc.connectors.list.useQuery();
  const setLlm = trpc.settings.setLlm.useMutation({
    onSuccess: () => {
      utils.settings.getLlm.invalidate();
      utils.ide.listLlmProviders.invalidate();
    },
  });

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"model" | "mode" | "connectors">("model");

  const openRouterModels = useMemo(() => {
    const list = orFree?.models?.length
      ? orFree.models
      : (data?.freeCloudModels ?? [])
          .filter((m) => m.provider === "openrouter")
          .map((m) => ({ id: m.id, name: m.name }));
    if (!list.some((m) => m.id === "openrouter/free")) {
      return [{ id: "openrouter/free", name: "OpenRouter Free (auto)" }, ...list];
    }
    return list;
  }, [orFree, data]);

  const nvidiaModels = useMemo(() => {
    if (nvidia?.models?.length) return nvidia.models;
    return (data?.freeCloudModels ?? [])
      .filter((m) => m.provider === "nvidia")
      .map((m) => ({ id: m.id, name: m.name }));
  }, [nvidia, data]);

  const activeModel = data?.activeModel ?? "openrouter/free";
  const activeProvider = data?.activeProvider ?? "openrouter";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px] text-[var(--color-text-primary)] hover:border-[var(--color-violet)]/50 ${
          compact ? "max-w-[160px]" : "max-w-[240px]"
        }`}
        title="Model, mode, connectors"
      >
        <Sparkles size={13} className="shrink-0 text-[var(--color-violet)]" />
        <span className="truncate font-[var(--font-mono)] text-[11px]">{activeModel}</span>
        <ChevronDown size={12} className="shrink-0 text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-[360px] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--glow-magenta)]">
            <div className="flex border-b border-[var(--color-line)] text-[11px]">
              {(
                [
                  ["model", "Models"],
                  ["mode", "Mode"],
                  ["connectors", "Connectors"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 px-2 py-2 ${
                    tab === id ? "bg-[var(--color-violet)]/15 text-[var(--color-violet)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {tab === "model" && (
                <>
                  <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-teal)]">
                    NVIDIA NIM
                  </p>
                  <p className="mb-2 px-1 text-[10px] text-[var(--color-text-muted)]">
                    Kimi · GLM · MiniMax · Laguna — build.nvidia.com
                  </p>
                  {!nvidia?.configured && (
                    <p className="mb-2 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 px-2 py-1.5 text-[11px] text-[var(--color-amber)]">
                      NVIDIA_API_KEY not set — add in .env
                    </p>
                  )}
                  {nvidiaModels.map((m) => (
                    <button
                      key={`nv-${m.id}`}
                      type="button"
                      disabled={setLlm.isPending}
                      onClick={() => {
                        setLlm.mutate({ provider: "nvidia", model: m.id });
                        setOpen(false);
                      }}
                      className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-surface-raised)]"
                    >
                      <span className="min-w-0 flex-1 truncate" title={m.name}>
                        {m.name}
                      </span>
                      <span className="max-w-[120px] truncate font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">
                        {m.id.split("/").pop()}
                      </span>
                      {activeProvider === "nvidia" && activeModel === m.id && (
                        <Check size={12} className="text-[var(--color-teal)]" />
                      )}
                    </button>
                  ))}

                  <p className="mb-1 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-violet)]">
                    OpenRouter free
                  </p>
                  {!orFree?.configured && (
                    <p className="mb-2 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 px-2 py-1.5 text-[11px] text-[var(--color-amber)]">
                      OPENROUTER_API_KEY not set
                    </p>
                  )}
                  {openRouterModels.map((m) => (
                    <button
                      key={`or-${m.id}`}
                      type="button"
                      disabled={setLlm.isPending}
                      onClick={() => {
                        setLlm.mutate({ provider: "openrouter", model: m.id });
                        setOpen(false);
                      }}
                      className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-surface-raised)]"
                    >
                      <span className="min-w-0 flex-1 truncate" title={m.name}>
                        {m.id}
                      </span>
                      {activeProvider === "openrouter" && activeModel === m.id && (
                        <Check size={12} className="text-[var(--color-teal)]" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {tab === "mode" && (
                <>
                  <p className="mb-2 px-1 text-[10px] text-[var(--color-text-muted)]">Provider routing mode</p>
                  {(
                    [
                      ["nvidia", "NVIDIA NIM"],
                      ["openrouter", "OpenRouter Free"],
                      ["auto", "Auto fallback chain"],
                      ["ollama", "Ollama local"],
                      ["groq", "Groq"],
                      ["gemini", "Gemini"],
                      ["anthropic", "Anthropic"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setLlm.mutate({
                          provider: id,
                          model:
                            id === "nvidia"
                              ? "minimaxai/minimax-m3"
                              : id === "openrouter"
                                ? "openrouter/free"
                                : null,
                        });
                      }}
                      className="mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] hover:bg-[var(--color-surface-raised)]"
                    >
                      {label}
                      {String(activeProvider) === id && <Check size={12} className="text-[var(--color-teal)]" />}
                    </button>
                  ))}
                </>
              )}

              {tab === "connectors" && (
                <>
                  <p className="mb-2 px-1 text-[10px] text-[var(--color-text-muted)]">
                    Env-backed connectors (set keys in .env — no secrets shown)
                  </p>
                  {(connectors?.connectors ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="mb-1 flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-2 py-1.5 text-[11px]"
                    >
                      <Plug size={12} className="text-[var(--color-violet)]" />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span
                        className={
                          c.configured ? "text-[var(--color-teal)]" : "text-[var(--color-text-muted)]"
                        }
                      >
                        {c.configured ? "on" : "off"}
                      </span>
                    </div>
                  ))}
                  <p className="mt-2 px-1 text-[10px] text-[var(--color-text-muted)]">
                    Add connectors: edit .env then open Plugins & Connectors. Summary:{" "}
                    {connectors?.summary.connected ?? 0} connected / {connectors?.summary.available ?? 0}{" "}
                    available.
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
