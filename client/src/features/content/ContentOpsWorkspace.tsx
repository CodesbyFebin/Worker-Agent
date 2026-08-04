import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";
import { ScriptStudioWorkspace } from "../script-studio/ScriptStudioWorkspace";

/**
 * ContentOps Workspace — research brief + draft + evidence (reference layout),
 * backed by scripts + claim ledger.
 */
export function ContentOpsWorkspace() {
  const { data: scripts } = trpc.script.list.useQuery();
  const [scriptId, setScriptId] = useState<string | null>(null);
  const activeId = scriptId ?? scripts?.[0]?.id ?? null;
  const { data: script } = trpc.script.getById.useQuery(
    { scriptId: activeId! },
    { enabled: Boolean(activeId) },
  );
  const { data: claims } = trpc.ledger.listByScript.useQuery(
    { scriptId: activeId! },
    { enabled: Boolean(activeId), refetchInterval: 5000 },
  );
  const utils = trpc.useUtils();
  const extract = trpc.ledger.extractAndLog.useMutation({
    onSuccess: () => utils.ledger.listByScript.invalidate(),
  });
  const verify = trpc.ledger.verifyPendingBatch.useMutation({
    onSuccess: () => utils.ledger.listByScript.invalidate(),
  });
  const [voice, setVoice] = useState("Expert");
  const [brief, setBrief] = useState({
    topic: "",
    audience: "Professionals",
    intent: "Informational",
    tone: "Expert",
    sources: "Primary sources preferred",
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Workspace"
        status="Draft saved locally via Script Studio"
        statusTone="teal"
        actions={
          <button
            type="button"
            disabled={!activeId || !script?.fullText}
            onClick={() => activeId && script?.fullText && extract.mutate({ scriptId: activeId, text: script.fullText })}
            className="rounded-full bg-[var(--color-violet)] px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            Check claims
          </button>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-12">
        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-3">
          <p className="font-[var(--font-mono)] text-[10px] uppercase text-[var(--color-text-muted)]">Research brief</p>
          <select
            value={activeId ?? ""}
            onChange={(e) => setScriptId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          >
            {(scripts ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {(
            [
              ["topic", "Topic"],
              ["audience", "Audience"],
              ["intent", "Intent"],
              ["tone", "Tone"],
              ["sources", "Source requirements"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="mt-2 block text-[10px] uppercase text-[var(--color-text-muted)]">
              {label}
              <input
                value={k === "topic" ? brief.topic || script?.title || "" : brief[k]}
                onChange={(e) => setBrief({ ...brief, [k]: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[12px] normal-case"
              />
            </label>
          ))}
          <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-2 text-[11px]">
            <p className="text-[var(--color-text-muted)]">Retrieved sources</p>
            <p className="mt-1 text-[var(--color-text-primary)]">
              {(claims ?? []).filter((c) => c.sourceUrl).length} claims with source URLs from ledger
            </p>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-5">
          <div className="mb-2 flex flex-wrap gap-1">
            {["Refine", "Repurpose", "Check claims", "Compare versions"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  if (b === "Check claims" && activeId && script?.fullText) {
                    extract.mutate({ scriptId: activeId, text: script.fullText });
                  }
                }}
                className="rounded-full border border-[var(--color-violet)]/40 px-2.5 py-1 text-[11px] text-[var(--color-violet)]"
              >
                {b}
              </button>
            ))}
          </div>
          <div className="mb-2 flex gap-1">
            {["Clear", "Expert", "Conversational"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVoice(v)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  voice === v ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <h2 className="text-[16px] font-semibold">{script?.title ?? "Select a script"}</h2>
          <pre className="mt-2 whitespace-pre-wrap font-[var(--font-body)] text-[13px] leading-relaxed text-[var(--color-text-primary)]">
            {script?.fullText || script?.sections?.map((s) => s.content).join("\n\n") || "No draft yet — open Drafts / Script Studio."}
          </pre>
          <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
            {script?.fullText?.split(/\s+/).filter(Boolean).length ?? 0} words · voice {voice}
          </p>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 lg:col-span-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase text-[var(--color-text-muted)]">
            Evidence & governance
          </p>
          <ul className="mt-2 space-y-2">
            {(claims ?? []).map((c, i) => (
              <li key={c.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-2 text-[12px]">
                <p>
                  <span className="text-[var(--color-text-muted)]">C{i + 1}</span> {c.claimText}
                </p>
                <p
                  className={
                    c.verificationStatus === "verified"
                      ? "text-[var(--color-teal)]"
                      : c.verificationStatus === "rejected"
                        ? "text-[var(--color-coral)]"
                        : "text-[var(--color-amber)]"
                  }
                >
                  {c.verificationStatus}
                  {c.sourceUrl ? " · has source" : ""}
                </p>
              </li>
            ))}
            {!claims?.length && <li className="text-[12px] text-[var(--color-text-muted)]">No claims for this script</li>}
          </ul>
          <button
            type="button"
            disabled={!activeId || verify.isPending}
            onClick={() => activeId && verify.mutate({ scriptId: activeId, limit: 3 })}
            className="mt-3 w-full rounded-xl bg-[var(--color-violet)] py-2 text-[12px] font-semibold text-white"
          >
            Approve draft / verify pending
          </button>
        </aside>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] px-3 py-2 text-[11px]">
        {["LinkedIn", "Forum", "Blog", "Newsletter", "Video Script"].map((x) => (
          <span key={x} className="rounded-lg border border-[var(--color-line)] px-2 py-1">
            {x}
          </span>
        ))}
        <span className="ml-auto text-[var(--color-teal)]">Next: Publishing</span>
      </div>
    </div>
  );
}

export function BloggingStudioWorkspace() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome title="Blogging Studio" status="Script Studio engine" statusTone="violet" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ScriptStudioWorkspace />
      </div>
    </div>
  );
}
