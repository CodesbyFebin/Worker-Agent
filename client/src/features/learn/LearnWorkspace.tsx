/**
 * Honest product docs / known limits — not a fake academy with invented courses.
 */
export function LearnWorkspace() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-vibe-brand text-2xl">Learn</h1>
      <p className="text-[14px] text-[var(--color-text-muted)]">
        How each sidebar page maps to real WorkerAgent.Cloud systems.
      </p>
      <section className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-[13px] leading-relaxed">
        <Row title="Overview" body="Live counts from campaigns, agents, scripts, ledger, approval queue." />
        <Row title="Workspace / Blogging / Drafts" body="Scripts + claim extract/verify. Blogging wraps Script Studio." />
        <Row title="Automations / Research-to-Post" body="Visual pipeline over real campaign day stages + trust gates." />
        <Row title="Agents" body="Versioned definitions, model/tool policies, executions, and evaluation suites." />
        <Row title="YouTube / Shorts & Reels" body="ContentOps studio: brief, preview, scenes, timeline, approve publish." />
        <Row title="Social Manager" body="Calendar from campaigns, publisher connector status, composer → claims." />
        <Row title="Templates" body="Few real workflows (campaign / God Machine / claim sweep) — not a fake 1000+ store." />
        <Row title="Plugins / Credentials" body="connectors.list from env — configured vs missing, never shows secrets." />
        <Row title="Evidence / Approvals / Publishing" body="Claim ledger Mission Control + AutoMode approval focus." />
        <Row title="Activity / Inbox / Calendar" body="agent_events, awaiting_approval tasks, campaign date spans." />
        <Row title="Governance / Settings" body="Policy toggles (local) + LLM/connector status." />
        <h2 className="pt-2 font-[var(--font-display)] text-sm font-bold uppercase tracking-wide text-[var(--color-coral)]">
          Intentionally not invented
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-muted)]">
          <li>Fake star/user marketplace metrics</li>
          <li>YouTube Analytics watch graphs</li>
          <li>Social DMs / OAuth refresh</li>
          <li>Music agent track (timeline visual only)</li>
        </ul>
      </section>
    </div>
  );
}

function Row({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wide text-[var(--color-teal)]">
        {title}
      </h2>
      <p className="mt-0.5">{body}</p>
    </div>
  );
}
