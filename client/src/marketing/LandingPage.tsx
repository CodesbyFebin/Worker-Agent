import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";

type LandingPageProps = {
  onLaunchApp: () => void;
};

const systems = [
  {
    title: "Intelligence",
    icon: BrainCircuit,
    features: ["Trend forecasting", "Competitor intelligence", "Retention Genome"],
  },
  {
    title: "Creation",
    icon: Video,
    features: ["Script DNA", "Hook simulation", "Thumbnail intelligence"],
  },
  {
    title: "Growth",
    icon: ChartNoAxesCombined,
    features: ["Experiments", "Timing optimization", "Playlist intelligence"],
  },
  {
    title: "Economics",
    icon: CircleDollarSign,
    features: ["RPM intelligence", "Per-video P&L", "Sponsorship signals"],
  },
  {
    title: "Governance",
    icon: ShieldCheck,
    features: ["Sanity Shield", "Copyright checks", "Approval + audit"],
  },
  {
    title: "Autonomy",
    icon: Zap,
    features: ["Provider routing", "Pipeline orchestration", "Learning loops"],
  },
] as const;

const loop = [
  ["01", "Trend data", "Ingest signals"],
  ["02", "Content", "Create and publish"],
  ["03", "Performance", "Measure outcomes"],
  ["04", "Genome", "Extract winning patterns"],
  ["05", "Decision", "Improve the next cycle"],
];

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-ink)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-ink)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-violet)]/50 bg-[var(--color-violet)]/10">
              <Sparkles className="h-4 w-4 text-[var(--color-violet)]" />
            </div>
            <span className="font-[var(--font-mono)] text-[13px] font-bold tracking-[0.18em]">
              WORKER<span className="text-[var(--color-violet)]">AGENT</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onLaunchApp}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-[12px] font-semibold transition hover:border-[var(--color-violet)]/60 hover:bg-[var(--color-surface-hover)]"
          >
            Launch Mission Control
          </button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 lg:pt-32">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--color-violet)]/10 blur-[140px]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)] shadow-[0_0_12px_var(--color-teal)]" />
              Autonomous operating system
            </div>
            <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em] text-white md:text-7xl">
              The operating system for
              <span className="block bg-gradient-to-r from-white via-[var(--color-violet)] to-[var(--color-teal)] bg-clip-text text-transparent">
                AI-powered content networks.
              </span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)] md:text-xl">
              Research trends. Create content. Enforce compliance. Run channels.
              <span className="text-white"> Learn from every result.</span>
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onLaunchApp}
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-slate-200"
              >
                Launch Mission Control
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <a
                href="#systems"
                className="rounded-xl border border-[var(--color-line)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Explore the systems
              </a>
            </div>
          </div>

          <div className="relative mx-auto mt-20 max-w-6xl overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_0_80px_rgba(124,92,255,0.08)]">
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
              <span className="ml-3 font-[var(--font-mono)] text-[10px] tracking-wider text-[var(--color-text-muted)]">
                MISSION CONTROL // SYSTEM ONLINE
              </span>
            </div>
            <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
              <div className="p-7 font-[var(--font-mono)] text-[12px] leading-7 md:p-10">
                <div className="text-[var(--color-violet)]">&gt; scanning intelligence streams...</div>
                <div className="text-[var(--color-text-secondary)]">14 high-opportunity signals detected.</div>
                <div className="mt-3 text-white">Top opportunity: AI browser agents</div>
                <div className="text-[var(--color-text-muted)]">Demand 91% · Competition 38% · Confidence 87%</div>
                <div className="mt-3 text-[var(--color-teal)]">&gt; mission decomposed · human approval required</div>
                <div className="mt-6 flex gap-2">
                  <span className="rounded-md bg-[var(--color-violet)] px-3 py-1.5 text-[10px] text-white">BUILD MISSION</span>
                  <span className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)]">ANALYZE</span>
                </div>
              </div>
              <div className="border-t border-[var(--color-line)] bg-black/20 p-6 lg:border-l lg:border-t-0">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">System status</p>
                <div className="mt-4 space-y-3 font-[var(--font-mono)] text-[11px]">
                  <div className="flex justify-between"><span>Workers</span><span className="text-[var(--color-teal)]">ACTIVE</span></div>
                  <div className="flex justify-between"><span>Governance</span><span className="text-[var(--color-teal)]">SHIELD ON</span></div>
                  <div className="flex justify-between"><span>Learning loop</span><span className="text-[var(--color-violet)]">OPTIMIZING</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--color-line)] bg-black/20 py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--color-violet)]">The compounding loop</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">Every upload makes the system smarter.</h2>
              <p className="mt-5 text-[var(--color-text-muted)] md:text-lg">Worker Agent turns publishing into a closed learning system instead of a sequence of disconnected tasks.</p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-5">
              {loop.map(([number, title, description]) => (
                <div key={number} className="bg-[var(--color-ink)] p-6">
                  <div className="font-[var(--font-mono)] text-[10px] text-[var(--color-violet)]">{number}</div>
                  <h3 className="mt-8 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="systems" className="mx-auto max-w-7xl px-6 py-24">
          <div className="text-center">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--color-violet)]">CC-OS control plane</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">Six systems. One operating loop.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systems.map(({ title, icon: Icon, features }) => (
              <article key={title} className="group rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--color-violet)]/50">
                <Icon className="h-7 w-7 text-[var(--color-violet)]" />
                <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-muted)]">
                  {features.map((feature) => <li key={feature}>• {feature}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-line)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 text-xs text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-[var(--font-mono)] tracking-wider">WORKERAGENT.CLOUD</span>
          <span>Autonomy with governance. Intelligence that compounds.</span>
        </div>
      </footer>
    </div>
  );
}
