import { useMemo, useState } from "react";
import { ArrowUp, BrainCircuit, CheckCircle2, Globe2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { trpc } from "../lib/trpc";

type Message = { role: "user" | "assistant"; content: string };
const starterPrompts = [
  "Find the strongest opportunities for an AI productivity channel this week.",
  "Build a compliant mission for the best opportunity.",
  "Analyze what the last publishing cycle taught us.",
];

export function CommandCenter() {
  const [input, setInput] = useState("");
  const [deepResearch, setDeepResearch] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Mission Control online. I can research opportunities, decompose missions, interpret performance, and route actions through governance. What should we work on?" },
  ]);

  const routerStatus = trpc.chat.status.useQuery(undefined, { refetchInterval: 15000, staleTime: 5000, retry: false });
  const chat = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((current) => [...current, { role: "assistant", content: `${data.reply}\n\n[${data.lane} · ${data.provider} · ${data.model} · ${data.attempts} attempt${data.attempts === 1 ? "" : "s"}${data.researchUsed ? " · web research" : ""}]` }]);
      void routerStatus.refetch();
    },
    onError: (error) => setMessages((current) => [...current, { role: "assistant", content: `System error: ${error.message}` }]),
  });
  const campaign = trpc.campaign.start.useMutation({
    onSuccess: (result) => setMessages((current) => [...current, { role: "assistant", content: `Mission created successfully. Campaign ${result.id ?? "is now queued"}. The CC-OS execution pipeline is active and governed; publication remains subject to the existing human approval gate.` }]),
    onError: (error) => setMessages((current) => [...current, { role: "assistant", content: `Mission creation failed: ${error.message}` }]),
  });

  const canSend = useMemo(() => input.trim().length > 0 && !chat.isPending && !campaign.isPending, [input, chat.isPending, campaign.isPending]);
  const activeResearchProviders = routerStatus.data?.lanes.research?.providers.filter((provider) => provider.enabled) ?? [];

  function sendMessage(value = input) {
    const content = value.trim();
    if (!content || chat.isPending || campaign.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    chat.mutate({ messages: nextMessages, lane: deepResearch ? "research" : "speed", research: deepResearch });
  }

  function buildMissionFromLatest() {
    const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content;
    campaign.mutate({ topic: latestUser?.slice(0, 500) || "AI productivity opportunities", totalDays: 7 });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-5 py-3">
        <div>
          <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--color-violet)]">Control plane</p>
          <h1 className="mt-0.5 text-lg font-semibold text-white">Mission Control</h1>
        </div>
        <div className="flex items-center gap-3 font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-teal)]" />{routerStatus.data?.runtime === "local" ? "Local runtime" : "Cloud runtime"}<span className="hidden text-[var(--color-line-strong)] sm:inline">·</span>System online</div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_270px]">
        <main className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 md:px-8">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-[85%] rounded-2xl bg-[var(--color-violet)] px-4 py-3 text-sm text-white" : "max-w-[92%] rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4"}>
                  {message.role === "assistant" && <div className="mb-2 flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-violet)]"><Sparkles className="h-3 w-3" /> Worker Agent</div>}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">{message.content}</p>
                  {message.role === "assistant" && index === messages.length - 1 && !chat.isPending && !campaign.isPending && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={buildMissionFromLatest} className="rounded-lg bg-[var(--color-violet)] px-3 py-1.5 text-[10px] font-semibold text-white hover:brightness-110">Build mission</button>
                      <button type="button" onClick={() => setDeepResearch(true)} className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[10px] font-semibold hover:bg-white/5">Deep research</button>
                      <button type="button" onClick={() => setInput("Analyze the latest result")} className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[10px] font-semibold hover:bg-white/5">Analyze</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(chat.isPending || campaign.isPending) && <div className="flex justify-start"><div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]"><span className="animate-pulse">{campaign.isPending ? "Creating governed campaign…" : deepResearch ? "Searching and synthesizing sources…" : "Analyzing intelligence streams…"}</span></div></div>}
          </div></div>

          <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-ink)] p-4 md:p-5"><div className="mx-auto max-w-4xl">
            {messages.length === 1 && <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{starterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)} className="shrink-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-left text-[10px] text-[var(--color-text-muted)] transition hover:border-[var(--color-violet)]/50 hover:text-white">{prompt}</button>)}</div>}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={deepResearch} onClick={() => setDeepResearch((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-wider transition ${deepResearch ? "border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-white" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white"}`}><Globe2 className="h-3.5 w-3.5" />Deep Research<span className={`h-1.5 w-1.5 rounded-full ${deepResearch ? "bg-[var(--color-teal)]" : "bg-[var(--color-line-strong)]"}`} /></button>
              {deepResearch && <span className="font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">{activeResearchProviders.length ? `${activeResearchProviders.map((provider) => provider.name).join(" + ")} available` : "No web-search provider configured"}</span>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="relative">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={2} placeholder={deepResearch ? "Ask Worker Agent to research the live web…" : "Ask Worker Agent to research, analyze, or build a mission…"} className="w-full resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 pr-14 text-sm text-white outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-violet)]/60" />
              <button type="submit" disabled={!canSend} aria-label="Send" className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-violet)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
            </form>
            <p className="mt-2 text-center font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">Governed actions require approval before execution.</p>
          </div></div>
        </main>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)]/40 p-4 lg:block">
          <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">God Router</p>
          <div className="mt-4 space-y-3">
            <Signal icon={TrendingUp} label="Speed" value={activeProvider(routerStatus.data?.lanes.speed?.providers)} detail="Priority-fallback lane" />
            <Signal icon={Globe2} label="Research" value={activeProvider(routerStatus.data?.lanes.research?.providers)} detail={activeResearchProviders.length ? "Web-grounded providers" : "Configure search provider"} />
            <Signal icon={BrainCircuit} label="Retention Genome" value="836 patterns" detail="+18 this cycle" />
            <Signal icon={CheckCircle2} label="Experiments" value="7 running" detail="2 awaiting readout" />
            <Signal icon={ShieldCheck} label="Governance" value="Shield active" detail="Approval required" />
          </div>
          <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-4"><p className="font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">Mission pipeline</p><div className="mt-4 space-y-2">{["Research", "Select", "Create", "Govern", "Approve", "Publish", "Measure", "Learn"].map((stage, index) => <div key={stage} className="flex items-center gap-3 text-[11px]"><span className={`h-1.5 w-1.5 rounded-full ${index < 2 ? "bg-[var(--color-teal)]" : "bg-[var(--color-line-strong)]"}`} /><span className={index < 2 ? "text-white" : "text-[var(--color-text-muted)]"}>{stage}</span></div>)}</div></div>
        </aside>
      </div>
    </div>
  );
}

function activeProvider(providers?: Array<{ name: string; enabled: boolean }>) { return providers?.find((provider) => provider.enabled)?.name ?? "Offline"; }
function Signal({ icon: Icon, label, value, detail }: { icon: typeof TrendingUp; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-4"><div className="flex items-center gap-2 text-[var(--color-violet)]"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span></div><div className="mt-3 text-lg font-semibold text-white">{value}</div><div className="mt-1 font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">{detail}</div></div>; }
