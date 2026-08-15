import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  CirclePlus,
  Globe2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { useResearchEvents, type ResearchStreamConnection, type ResearchStreamEvent } from "../hooks/useResearchEvents";

type Message = { role: "user" | "assistant"; content: string };

const welcomeMessage: Message = {
  role: "assistant",
  content: "Mission Control online. I can research opportunities, decompose governed missions, interpret performance, and route actions through CC-OS. What should we work on today?",
};

const starterPrompts = [
  "Find the strongest opportunities for an AI productivity channel this week.",
  "Analyze competitors in the AI browser agent category.",
  "Build a governed content mission from the strongest opportunity.",
  "Explain what the latest publishing cycle taught us.",
];

export function CommandCenter() {
  const [input, setInput] = useState("");
  const [deepResearch, setDeepResearch] = useState(false);
  const [activeResearchRunId, setActiveResearchRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const researchStream = useResearchEvents();

  const routerStatus = trpc.chat.status.useQuery(undefined, {
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });

  const chat = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${data.reply}\n\n[${data.lane} · ${data.provider} · ${data.model} · ${data.attempts} attempt${data.attempts === 1 ? "" : "s"}${data.researchUsed ? " · web research" : ""}]`,
        },
      ]);
      void routerStatus.refetch();
    },
    onError: (error) => {
      setMessages((current) => [...current, { role: "assistant", content: `System error: ${error.message}` }]);
    },
  });

  const campaign = trpc.campaign.start.useMutation({
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Mission created successfully. Campaign ${result.id ?? "is now queued"}. The CC-OS execution pipeline is active and governed; publication remains subject to the existing human approval gate.`,
        },
      ]);
    },
    onError: (error) => {
      setMessages((current) => [...current, { role: "assistant", content: `Mission creation failed: ${error.message}` }]);
    },
  });

  const canSend = useMemo(
    () => input.trim().length > 0 && !chat.isPending && !campaign.isPending,
    [input, chat.isPending, campaign.isPending],
  );

  const activeResearchProviders =
    routerStatus.data?.lanes.research?.providers.filter((provider) => provider.enabled && provider.cooldownSeconds === 0) ?? [];
  const coolingProviders = Object.values(routerStatus.data?.lanes ?? {}).flatMap((lane) =>
    lane.providers.filter((provider) => provider.cooldownSeconds > 0),
  );
  const activeResearchEvents = useMemo(
    () => (activeResearchRunId ? researchStream.events.filter((event) => event.runId === activeResearchRunId) : []),
    [activeResearchRunId, researchStream.events],
  );

  function sendMessage(value = input) {
    const content = value.trim();
    if (!content || chat.isPending || campaign.isPending) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    const researchRunId = deepResearch ? crypto.randomUUID() : undefined;
    setMessages(nextMessages);
    setInput("");
    setActiveResearchRunId(researchRunId ?? null);

    chat.mutate({
      messages: nextMessages,
      lane: deepResearch ? "research" : "speed",
      research: deepResearch,
      researchRunId,
    });
  }

  function buildMissionFromLatest() {
    const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content;
    campaign.mutate({ topic: latestUser?.slice(0, 500) || "AI productivity opportunities", totalDays: 7 });
  }

  function resetMission() {
    setMessages([welcomeMessage]);
    setInput("");
    setActiveResearchRunId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#06080c] text-[var(--color-text-primary)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-line)] px-5 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-white">Mission Control</h1>
            <span className="hidden items-center gap-1.5 font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-teal)] shadow-[var(--glow-green)]" />
              System online
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Your autonomous command center.</p>
        </div>

        <button type="button" onClick={resetMission} className="inline-flex items-center gap-2 rounded-lg border border-[#7164ff]/25 bg-[#7164ff]/10 px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#7164ff]/16">
          <CirclePlus className="h-3.5 w-3.5" />
          New Mission
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_286px]">
        <main className="flex min-h-0 min-w-0 flex-col border-r border-[var(--color-line)]">
          <div className="min-h-0 flex-1 overflow-y-auto operator-grid">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-7 md:py-8">
              {messages.map((message, index) => {
                const isLatestAssistant = message.role === "assistant" && index === messages.length - 1;
                return (
                  <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={message.role === "user" ? "max-w-[86%] rounded-xl border border-[#7164ff]/30 bg-gradient-to-br from-[#4d3bd7] to-[#2e236f] px-4 py-3 text-sm text-white shadow-[0_0_24px_rgba(109,93,252,0.10)]" : "max-w-[94%]"}>
                      {message.role === "assistant" ? (
                        <div className="flex gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4f36d8] text-white shadow-[0_0_20px_rgba(109,93,252,0.2)]">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="operator-panel min-w-0 flex-1 px-4 py-4 md:px-5">
                            <div className="mb-2 font-[var(--font-mono)] text-[8px] uppercase tracking-[0.16em] text-[#8175ff]">Worker Agent</div>
                            <p className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--color-text-secondary)]">{message.content}</p>
                            {isLatestAssistant && !chat.isPending && !campaign.isPending && messages.length > 1 && (
                              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
                                <button type="button" onClick={buildMissionFromLatest} className="rounded-md bg-[var(--color-violet)] px-3 py-2 text-[9px] font-semibold text-white hover:brightness-110">Build Mission</button>
                                <button type="button" onClick={() => setDeepResearch(true)} className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[9px] font-semibold text-[var(--color-text-secondary)] hover:border-[#7164ff]/50 hover:text-white">Deep Research</button>
                                <button type="button" onClick={() => setInput("Analyze the latest result and recommend the next governed action.")} className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[9px] font-semibold text-[var(--color-text-secondary)] hover:border-[#7164ff]/50 hover:text-white">Analyze Further</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-[12px] leading-5">{message.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {campaign.isPending && (
                <SystemWorking text="Creating governed campaign…" />
              )}
              {chat.isPending && deepResearch && (
                <ResearchProgress events={activeResearchEvents} connection={researchStream.connection} />
              )}
              {chat.isPending && !deepResearch && (
                <SystemWorking text="Analyzing intelligence streams…" />
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--color-line)] bg-[#07090d]/96 p-4 md:px-6 md:py-4">
            <div className="mx-auto max-w-4xl">
              <div className="operator-panel-glow p-2">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={2}
                    placeholder={deepResearch ? "Ask Worker Agent to research the live web…" : "Ask Worker Agent…"}
                    className="min-h-[50px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-[12px] text-white outline-none placeholder:text-[var(--color-text-muted)] focus:shadow-none"
                  />
                  <button type="submit" disabled={!canSend} onClick={() => sendMessage()} aria-label="Send" className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-violet)] text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] px-2 pt-2">
                  <button type="button" aria-pressed={deepResearch} onClick={() => setDeepResearch((value) => !value)} className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 font-[var(--font-mono)] text-[8px] uppercase tracking-[0.12em] ${deepResearch ? "bg-[#7164ff]/12 text-[#9a91ff]" : "text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white"}`}>
                    <Globe2 className="h-3 w-3" />
                    Deep Research
                    <span className={`h-1.5 w-1.5 rounded-full ${deepResearch ? "bg-[var(--color-teal)]" : "bg-[var(--color-line-strong)]"}`} />
                  </button>
                  <span className="font-[var(--font-mono)] text-[8px] text-[var(--color-text-muted)]">
                    {deepResearch ? `${activeResearchProviders.length} web-grounded provider${activeResearchProviders.length === 1 ? "" : "s"} · stream ${researchStream.connection}` : "Governed actions require approval"}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {starterPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => sendMessage(prompt)} className="shrink-0 rounded-full border border-[var(--color-line)] bg-[#0a0c11] px-3 py-1.5 text-[9px] text-[var(--color-text-muted)] hover:border-[#7164ff]/40 hover:text-white">
                    {prompt.length > 44 ? `${prompt.slice(0, 44)}…` : prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden min-h-0 overflow-y-auto bg-[#080a0f] p-4 lg:block">
          <div className="flex items-center justify-between">
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Live Signals</p>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-teal)] shadow-[var(--glow-green)]" />
          </div>

          <div className="mt-4 space-y-3">
            <LiveSignal
              icon={TrendingUp}
              label="Trend Intelligence"
              value={activeResearchProviders.length ? `${activeResearchProviders.length} live` : "Offline"}
              detail={activeResearchProviders.length ? "Web-grounded research providers" : "Configure a search-capable provider"}
              tone={activeResearchProviders.length ? "green" : "muted"}
            />
            <LiveSignal icon={Zap} label="RPM Intelligence" value="No feed" detail="Awaiting economics telemetry" tone="muted" />
            <LiveSignal icon={BrainCircuit} label="Retention Genome" value="No feed" detail="Awaiting retention telemetry" tone="violet" />
            <LiveSignal icon={CheckCircle2} label="Active Experiments" value="No feed" detail="Awaiting experiment telemetry" tone="muted" />
            <LiveSignal icon={ShieldCheck} label="Governance Shield" value="ACTIVE" detail="Human approval remains enforced" tone="green" />
          </div>

          <div className="operator-panel mt-3 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Wifi className="h-3.5 w-3.5" />
              <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em]">Research stream</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-white">SSE</span>
              <span className={researchStream.connection === "connected" ? "font-[var(--font-mono)] text-[9px] text-[var(--color-teal)]" : "font-[var(--font-mono)] text-[9px] text-amber-300"}>{researchStream.connection}</span>
            </div>
          </div>

          {coolingProviders.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.035] p-4">
              <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em] text-amber-300">Provider cooldowns</p>
              <div className="mt-3 space-y-2">
                {coolingProviders.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--color-text-secondary)]">{provider.name}</span>
                    <span className="font-[var(--font-mono)] text-amber-300">{provider.cooldownSeconds}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="operator-panel mt-3 p-4">
            <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Mission pipeline</p>
            <div className="mt-4 space-y-2.5">
              {["Research", "Select", "Create", "Govern", "Approve", "Publish", "Measure", "Learn"].map((stage, index) => (
                <div key={stage} className="flex items-center gap-3 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${index < 2 ? "bg-[#8175ff]" : "bg-[var(--color-line-strong)]"}`} />
                  <span className={index < 2 ? "text-white" : "text-[var(--color-text-muted)]"}>{stage}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setInput("Summarize all currently available live signals and identify missing telemetry feeds.")} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--color-line)] px-4 py-3 text-[10px] text-[var(--color-text-secondary)] hover:border-[#7164ff]/40 hover:text-white">
            View all signals
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </aside>
      </div>
    </div>
  );
}

function SystemWorking({ text }: { text: string }) {
  return (
    <div className="flex justify-start pl-11">
      <div className="operator-panel px-4 py-3 font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">
        <span className="animate-pulse">{text}</span>
      </div>
    </div>
  );
}

function ResearchProgress({ events, connection }: { events: ResearchStreamEvent[]; connection: ResearchStreamConnection }) {
  return (
    <div className="flex justify-start pl-11">
      <div className="operator-panel-glow w-full max-w-[92%] px-4 py-4">
        <div className="flex items-center justify-between gap-3 font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em]">
          <span className="flex items-center gap-2 text-[#9187ff]"><Globe2 className="h-3 w-3" />Live research</span>
          <span className="text-[var(--color-text-muted)]">SSE {connection}</span>
        </div>
        <div className="mt-3 space-y-2 font-[var(--font-mono)] text-[9px]">
          {events.length === 0 ? (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8175ff]" />Waiting for the research executor…</div>
          ) : events.map((event, index) => (
            <div key={`${event.runId}-${event.phase}-${index}`} className="flex items-start gap-2">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${event.phase === "completed" ? "bg-[var(--color-teal)]" : event.phase === "failed" ? "bg-red-400" : "animate-pulse bg-[#8175ff]"}`} />
              <div>
                <span className={event.phase === "failed" ? "text-red-300" : "text-[var(--color-text-secondary)]"}>{event.message}</span>
                {event.provider && <div className="mt-1 text-[8px] text-[var(--color-text-muted)]">{event.provider}{event.model ? ` · ${event.model}` : ""}{event.attempts ? ` · ${event.attempts} attempt${event.attempts === 1 ? "" : "s"}` : ""}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveSignal({ icon: Icon, label, value, detail, tone }: { icon: typeof TrendingUp; label: string; value: string; detail: string; tone: "green" | "violet" | "muted" }) {
  const toneClass = tone === "green" ? "text-[var(--color-teal)]" : tone === "violet" ? "text-[#8175ff]" : "text-[var(--color-text-muted)]";
  return (
    <div className="operator-panel p-4">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        <span className="text-[9px]">{label}</span>
      </div>
      <div className={`mt-3 text-[20px] font-semibold tracking-[-0.03em] ${tone === "muted" ? "text-white" : toneClass}`}>{value}</div>
      <div className="mt-1 font-[var(--font-mono)] text-[8px] leading-4 text-[var(--color-text-muted)]">{detail}</div>
    </div>
  );
}
