import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleDollarSign,
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
  { title: "Intelligence", icon: BrainCircuit, features: ["Trend forecasting", "Competitor intelligence", "Retention Genome"] },
  { title: "Creation", icon: Video, features: ["Script DNA", "Hook simulation", "Thumbnail intelligence"] },
  { title: "Growth", icon: ChartNoAxesCombined, features: ["A/B experiments", "Timing optimization", "Playlist intelligence"] },
  { title: "Economics", icon: CircleDollarSign, features: ["RPM intelligence", "Per-video P&L", "Sponsorship signals"] },
  { title: "Governance", icon: ShieldCheck, features: ["Sanity Shield", "Copyright checks", "Approval + audit"] },
  { title: "Autonomy", icon: Zap, features: ["Provider routing", "Pipeline orchestration", "Learning loops"] },
] as const;

const loop = [
  { title: "Trend Data", detail: "Ingest real-time signals", icon: TrendingUp },
  { title: "Content Created", detail: "Generate & publish", icon: Play },
  { title: "Performance", detail: "Measure retention & RPM", icon: BarChart3 },
  { title: "Retention Genome", detail: "Extract winning patterns", icon: BrainCircuit },
  { title: "Better Decisions", detail: "Optimize the next cycle", icon: RotateCw },
] as const;

const demoStats = [
  ["836+", "Retention patterns"],
  ["14K+", "Signals analyzed daily"],
  ["91%", "Avg. retention lift"],
  ["$82", "Avg. RPM increase"],
] as const;

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050608]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-8">
          <a href="#product" className="flex items-center gap-2 text-white">
            <span className="text-[15px] font-bold tracking-[-0.02em]">WORKER</span>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--color-violet)]">AGENT</span>
          </a>

          <nav className="hidden items-center gap-7 text-[12px] text-[var(--color-text-secondary)] md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#systems" className="hover:text-white">Systems</a>
            <a href="#learning-loop" className="hover:text-white">Learning Loop</a>
            <a href="https://github.com/CodesbyFebin/Worker-Agent" className="hover:text-white">Docs</a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onLaunchApp} className="hidden px-3 py-2 text-[12px] text-[var(--color-text-secondary)] hover:text-white sm:block">
              Sign in
            </button>
            <button type="button" onClick={onLaunchApp} className="rounded-lg bg-white px-4 py-2.5 text-[11px] font-semibold text-black hover:bg-slate-200">
              Launch Mission Control
            </button>
          </div>
        </div>
      </header>

      <main id="product">
        <section className="operator-nebula relative overflow-hidden border-b border-white/[0.05]">
          <div className="operator-grid pointer-events-none absolute inset-0 opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
          <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-[70rem] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[110px]" />

          <div className="relative mx-auto max-w-[1440px] px-5 pb-20 pt-20 md:px-8 md:pt-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-teal)] shadow-[var(--glow-green)]" />
                System online · Worker Agent control plane
              </div>

              <h1 className="text-balance text-[44px] font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-[72px]">
                The autonomous operating system
                <span className="mt-2 block text-[#7164ff]">for AI content networks</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg">
                Research trends. Create content. Enforce compliance.
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
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <div className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  System online // worker_agent_v2.0
                </div>
                <div className="hidden items-center gap-2 font-[var(--font-mono)] text-[9px] text-[var(--color-teal)] sm:flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-teal)]" /> Online
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_270px]">
                <div className="p-6 font-[var(--font-mono)] text-[11px] leading-6 sm:p-8">
                  <div className="text-[var(--color-teal)]">&gt; Analyzing market saturation...</div>
                  <div className="text-[var(--color-teal)]">&gt; Ingesting trend data from 12 sources...</div>
                  <div className="text-[var(--color-teal)]">&gt; Running competitor autopsy...</div>
                  <div className="mt-3 text-white">Detected 14 high-opportunity niches.</div>
                  <div>Top Pick: <span className="text-[#8175ff]">AI Browser Agents</span></div>
                  <div className="text-[var(--color-text-secondary)]">Demand: 91% <span className="mx-2 text-[var(--color-line-strong)]">|</span> Competition: 38% <span className="mx-2 text-[var(--color-line-strong)]">|</span> RPM: 82%</div>
                  <div className="mt-3 text-[var(--color-teal)]">&gt; Mission decomposed. Awaiting approval.</div>
                  <div className="mt-3 text-[var(--color-teal)]">&gt; Ready for your command. <span className="animate-pulse">_</span></div>

                  <div className="mt-6 flex flex-wrap gap-2 font-sans">
                    <span className="rounded-md bg-[var(--color-violet)] px-3 py-2 text-[10px] font-semibold text-white">Build Mission</span>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Analyze</span>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Simulate</span>
                    <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-[10px] text-[var(--color-text-secondary)]">Learn Loop</span>
                  </div>
                </div>

                <div className="border-t border-[var(--color-line)] bg-black/25 p-5 lg:border-l lg:border-t-0">
                  <div className="operator-panel p-4">
                    <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">System status</p>
                    <div className="mt-4 space-y-3 font-[var(--font-mono)] text-[10px]">
                      <StatusRow label="Workers" value="Active" tone="green" />
                      <StatusRow label="Compliance" value="Shield On" tone="green" />
                      <StatusRow label="Learn Loop" value="Optimizing" tone="violet" />
                      <StatusRow label="Data ingestion" value="Streaming" tone="violet" />
                      <StatusRow label="Infrastructure" value="Healthy" tone="green" />
                    </div>
                  </div>
                  <div className="operator-panel mt-3 p-4">
                    <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Active pipeline</p>
                    <div className="mt-4 flex h-12 items-end gap-1">
                      {[30, 62, 42, 34, 70, 38, 48, 76, 54, 88].map((height, index) => (
                        <span key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-950 to-[#7164ff]" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <p className="mt-2 font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">7 missions in progress</p>
                  </div>
                </div>
              </div>
            </div>

            <section id="learning-loop" className="mx-auto mt-14 max-w-5xl text-center">
              <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.26em] text-[var(--color-text-muted)]">The Learning Loop</p>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Every upload makes the system smarter</h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-5">
                {loop.map(({ title, detail, icon: Icon }, index) => (
                  <div key={title} className="relative flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#7164ff]/30 bg-[#7164ff]/10 text-[#8175ff] shadow-[0_0_24px_rgba(109,93,252,0.12)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < loop.length - 1 && <ArrowRight className="absolute left-[calc(50%+38px)] top-4 hidden h-4 w-4 text-[#7164ff]/55 sm:block" />}
                    <h3 className="mt-3 text-[11px] font-semibold text-white">{title}</h3>
                    <p className="mt-1 max-w-[125px] text-[10px] leading-4 text-[var(--color-text-muted)]">{detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="operator-panel mx-auto mt-10 grid max-w-5xl grid-cols-2 divide-x divide-y divide-[var(--color-line)] overflow-hidden sm:grid-cols-4 sm:divide-y-0">
              {demoStats.map(([value, label]) => (
                <div key={label} className="px-5 py-4 text-center sm:text-left">
                  <div className="text-xl font-semibold text-white">{value}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="systems" className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.22em] text-[#8175ff]">CC-OS control plane</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white md:text-5xl">Six systems. One operating loop.</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">A governed content operating system that connects intelligence, creation, growth, economics, safety and autonomy into one command surface.</p>
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

function StatusRow({ label, value, tone }: { label: string; value: string; tone: "green" | "violet" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={tone === "green" ? "text-[var(--color-teal)]" : "text-[#8175ff]"}>{value}</span>
    </div>
  );
}
