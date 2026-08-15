import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleDollarSign,
  Command,
  Play,
  RotateCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
  Zap,
} from "lucide-react";

type LandingPageProps = {
  onLaunchApp: () => void;
};

const systems = [
  { title: "Intelligence", icon: BrainCircuit, features: ["Research orchestration", "Opportunity discovery", "Evidence-aware analysis"] },
  { title: "Creation", icon: Video, features: ["Script workflows", "Content operations", "Publishing pipelines"] },
  { title: "Growth", icon: ChartNoAxesCombined, features: ["Experiment workflows", "Performance analysis", "Optimization cycles"] },
  { title: "Economics", icon: CircleDollarSign, features: ["Cost-aware routing", "Provider telemetry", "Operational visibility"] },
  { title: "Governance", icon: ShieldCheck, features: ["Sanity Shield", "Approval gates", "Auditability"] },
  { title: "Autonomy", icon: Zap, features: ["Multi-agent execution", "Pipeline orchestration", "Learning loops"] },
] as const;

const loop = [
  { title: "Signal", detail: "Ingest an opportunity", icon: TrendingUp },
  { title: "Research", detail: "Gather and evaluate evidence", icon: BrainCircuit },
  { title: "Create", detail: "Turn intent into assets", icon: Play },
  { title: "Measure", detail: "Observe the outcome", icon: BarChart3 },
  { title: "Learn", detail: "Improve the next decision", icon: RotateCw },
] as const;

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050608]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-8">
          <a href="#product" className="flex items-center gap-2 text-white" aria-label="Worker Agent home">
            <span className="text-[15px] font-bold tracking-[-0.02em]">WORKER</span>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--color-violet)]">AGENT</span>
          </a>

          <nav className="hidden items-center gap-7 text-[12px] text-[var(--color-text-secondary)] md:flex" aria-label="Main navigation">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#systems" className="hover:text-white">Systems</a>
            <a href="#learning-loop" className="hover:text-white">Learning Loop</a>
            <a href="https://github.com/CodesbyFebin/Worker-Agent" target="_blank" rel="noreferrer" className="hover:text-white">Source</a>
          </nav>

          <button type="button" onClick={onLaunchApp} className="rounded-lg bg-white px-4 py-2.5 text-[11px] font-semibold text-black shadow-[0_0_34px_rgba(255,255,255,0.10)] hover:-translate-y-0.5 hover:bg-slate-200">
            Launch Mission Control
          </button>
        </div>
      </header>

      <main id="product">
        <section className="operator-nebula relative overflow-hidden border-b border-white/[0.05]">
          <div className="operator-grid pointer-events-none absolute inset-0 opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
          <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-[70rem] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[110px]" />
          <div className="pointer-events-none absolute left-[12%] top-48 h-64 w-64 rounded-full bg-violet-700/10 blur-[100px]" />

          <div className="relative mx-auto max-w-[1440px] px-5 pb-20 pt-20 md:px-8 md:pt-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-violet)] shadow-[var(--glow-violet)]" />
                WorkerAgent.Cloud · product preview
              </div>

              <h1 className="text-balance text-[44px] font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-[72px]">
                The autonomous operating system
                <span className="mt-2 block text-[#7164ff]">for AI content networks</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg">
                Research opportunities. Create content. Enforce governance.
                <span className="block">Learn from every result.</span>
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button type="button" onClick={onLaunchApp} className="group inline-flex min-w-[220px] items-center justify-center gap-3 rounded-lg bg-white px-6 py-3.5 text-[13px] font-semibold text-black shadow-[0_0_34px_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:bg-slate-200">
                  Launch Mission Control
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <a href="#systems" className="inline-flex min-w-[170px] items-center justify-center rounded-lg border border-white/[0.16] bg-black/20 px-6 py-3.5 text-[13px] font-semibold text-white hover:border-[#7164ff]/60 hover:bg-[#7164ff]/5">
                  Explore CC-OS
                </a>
              </div>
            </div>

            <div className="operator-panel-glow mx-auto mt-16 max-w-5xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3">
                <div className="flex items-center gap-2" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  <Command className="h-3 w-3" />
                  Product preview // illustrative workflow
                </div>
                <div className="hidden font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)] sm:block">Not live telemetry</div>
              </div>

              <div className="grid lg:grid-cols-[1fr_270px]">
                <div className="p-6 font-[var(--font-mono)] text-[11px] leading-6 sm:p-8">
                  <div className="text-[var(--color-teal)]">&gt; Receiving operator command...</div>
                  <div className="text-[var(--color-teal)]">&gt; Planning a governed research mission...</div>
                  <div className="text-[var(--color-teal)]">&gt; Routing work across CC-OS capabilities...</div>
                  <div className="mt-3 text-white">Mission plan ready for review.</div>
                  <div className="text-[var(--color-text-secondary)]">Research → evidence → content → review → publish</div>
                  <div className="mt-3 text-[var(--color-teal)]">&gt; Governance checkpoint inserted.</div>
                  <div className="mt-3 text-[var(--color-teal)]">&gt; Waiting for your command. <span className="animate-pulse">_</span></div>

                  <div className="mt-6 flex flex-wrap gap-2 font-sans">
                    <button type="button" onClick={onLaunchApp} className="rounded-md bg-[var(--color-violet)] px-3 py-2 text-[10px] font-semibold text-white hover:brightness-110">Open Mission Control</button>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Research</span>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Simulate</span>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Learn Loop</span>
                  </div>
                </div>

                <div className="border-t border-[var(--color-line)] bg-black/25 p-5 lg:border-l lg:border-t-0">
                  <div className="operator-panel p-4">
                    <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Preview surfaces</p>
                    <div className="mt-4 space-y-3 font-[var(--font-mono)] text-[10px]">
                      <StatusRow label="Mission Control" value="Ready" tone="violet" />
                      <StatusRow label="Research stream" value="Available in app" tone="violet" />
                      <StatusRow label="Governance" value="Enforced in app" tone="green" />
                      <StatusRow label="tRPC" value="Existing backend" tone="green" />
                      <StatusRow label="Telemetry" value="Not shown here" tone="muted" />
                    </div>
                  </div>
                  <div className="operator-panel mt-3 p-4">
                    <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Execution loop</p>
                    <div className="mt-4 flex h-12 items-end gap-1">
                      {[28, 46, 34, 58, 42, 72, 54, 80, 62, 88].map((height, index) => (
                        <span key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-950 to-[#7164ff]" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <p className="mt-2 font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">Illustrative only · live state is shown after sign-in</p>
                  </div>
                </div>
              </div>
            </div>

            <section id="learning-loop" className="mx-auto mt-14 max-w-5xl text-center">
              <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.26em] text-[var(--color-text-muted)]">The Learning Loop</p>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Every completed cycle can improve the next decision</h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-5">
                {loop.map(({ title, detail, icon: Icon }, index) => (
                  <div key={title} className="relative flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#7164ff]/30 bg-[#7164ff]/10 text-[#8175ff] shadow-[0_0_24px_rgba(109,93,252,0.12)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < loop.length - 1 && <ArrowRight className="absolute left-[calc(50%+38px)] top-4 hidden h-4 w-4 text-[#7164ff]/55 sm:block" />}
                    <h3 className="mt-3 text-[11px] font-semibold text-white">{title}</h3>
                    <p className="mt-1 max-w-[145px] text-[10px] leading-4 text-[var(--color-text-muted)]">{detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="operator-panel mx-auto mt-10 max-w-5xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-line)] sm:grid-cols-4 sm:divide-y-0">
                {[
                  ["Research", "Evidence-aware discovery"],
                  ["Create", "Content operations"],
                  ["Govern", "Approval + audit"],
                  ["Learn", "Feedback into the next cycle"],
                ].map(([value, label]) => (
                  <div key={value} className="px-5 py-4 text-center sm:text-left">
                    <div className="text-sm font-semibold text-white">{value}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="systems" className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.22em] text-[#8175ff]">CC-OS control plane</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white md:text-5xl">Six systems. One operating loop.</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">Worker Agent connects research, creation, growth, economics, governance and autonomy without introducing a second application framework.</p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {systems.map(({ title, icon: Icon, features }) => (
              <article key={title} className="operator-panel group p-6 hover:-translate-y-0.5 hover:border-[#7164ff]/45">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#7164ff]/25 bg-[#7164ff]/8 text-[#8175ff]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                <ul className="mt-4 space-y-2 text-[12px] text-[var(--color-text-muted)]">
                  {features.map((feature) => <li key={feature}>• {feature}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <div className="operator-panel-glow mt-8 flex flex-col items-start justify-between gap-5 p-6 md:flex-row md:items-center md:p-7">
            <div>
              <div className="flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <Sparkles className="h-3.5 w-3.5 text-[#8175ff]" />
                Operator surface
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white">One command surface. Existing CC-OS underneath.</h3>
              <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[var(--color-text-muted)]">The public experience is the front door; Mission Control remains the authenticated workspace for the existing React, tRPC and governance stack.</p>
            </div>
            <button type="button" onClick={onLaunchApp} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-violet)] px-4 py-3 text-[11px] font-semibold text-white shadow-[var(--glow-violet)] hover:brightness-110">
              Enter Mission Control
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-line)] bg-black/25 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 text-[10px] text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span className="font-[var(--font-mono)] tracking-[0.14em]">WORKERAGENT.CLOUD</span>
          <span>Autonomy with governance. Intelligence that compounds.</span>
        </div>
      </footer>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: "green" | "violet" | "muted" }) {
  const toneClass = tone === "green" ? "text-[var(--color-teal)]" : tone === "violet" ? "text-[#8175ff]" : "text-[var(--color-text-muted)]";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={toneClass}>{value}</span>
    </div>
  );
}
