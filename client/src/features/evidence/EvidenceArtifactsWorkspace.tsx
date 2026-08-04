import { useState } from "react";
import { Archive, Radar, Search, Snowflake } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";
import { ClaimLedgerWorkspace } from "../claim-ledger/ClaimLedgerWorkspace";

type Tab = "claims" | "artifacts" | "snapshots" | "retrieve";

/**
 * Evidence workspace — Claim Ledger plus Phase 9 artifacts / snapshots / retrieval.
 */
export function EvidenceArtifactsWorkspace({ mode = "evidence" }: { mode?: "evidence" | "ledger" }) {
  const [tab, setTab] = useState<Tab>(mode === "ledger" ? "claims" : "claims");
  const utils = trpc.useUtils();
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("notes.txt");
  const [content, setContent] = useState("Evidence note");
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  const storage = trpc.artifacts.storageStatus.useQuery();
  const artifacts = trpc.artifacts.list.useQuery({ limit: 40 }, { refetchInterval: 8000 });
  const snaps = trpc.artifacts.listSnapshots.useQuery(undefined, { refetchInterval: 8000 });
  const stale = trpc.artifacts.staleSources.useQuery({ maxFreshness: 0.35 });
  const artifactDetail = trpc.artifacts.get.useQuery(
    { artifactId: selectedArtifact! },
    { enabled: Boolean(selectedArtifact) },
  );
  const snapDetail = trpc.artifacts.getSnapshot.useQuery(
    { snapshotId: selectedSnapshot! },
    { enabled: Boolean(selectedSnapshot) },
  );
  const retrieve = trpc.artifacts.retrieve.useQuery(
    { query },
    { enabled: tab === "retrieve" && query.trim().length > 1 },
  );

  const create = trpc.artifacts.create.useMutation({
    onSuccess: () => {
      setMsg("Artifact stored");
      void utils.artifacts.list.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const capture = trpc.artifacts.captureEvidence.useMutation({
    onSuccess: (r) => {
      setMsg(`Snapshot ${r.snapshotId.slice(0, 8)}… · ${r.verification.status}`);
      setSelectedSnapshot(r.snapshotId);
      void utils.artifacts.listSnapshots.invalidate();
      void utils.artifacts.list.invalidate();
      void utils.ledger.listRecent.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const recentClaims = trpc.ledger.listRecent.useQuery({ limit: 20 });

  if (tab === "claims") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 gap-1 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
          {(
            [
              ["claims", "Claims"],
              ["artifacts", "Artifacts"],
              ["snapshots", "Evidence snapshots"],
              ["retrieve", "Retrieval"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] ${
                tab === id ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
            store={storage.data?.backend}
            {storage.data?.endpoint ? ` · ${storage.data.endpoint}` : ""}
            {storage.data?.localDir ? ` · ${storage.data.localDir}` : ""}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <ClaimLedgerWorkspace />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Evidence & Artifacts"
        status={`Storage: ${storage.data?.backend ?? "…"}`}
        statusTone="teal"
      />
      {msg && (
        <p className="shrink-0 border-b border-[var(--color-line)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
          {msg}
        </p>
      )}
      <div className="flex shrink-0 gap-1 border-b border-[var(--color-line)] px-3 py-2">
        {(
          [
            ["claims", "Claims"],
            ["artifacts", "Artifacts"],
            ["snapshots", "Evidence snapshots"],
            ["retrieve", "Retrieval"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] ${
              tab === id ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "artifacts" && (
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                <h2 className="flex items-center gap-1 text-[12px] font-semibold">
                  <Archive size={12} /> Upload text artifact
                </h2>
                <div className="mt-2 grid gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                    placeholder="filename"
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={create.isPending}
                    onClick={() =>
                      create.mutate({
                        name,
                        content,
                        contentType: "text/plain",
                        kind: "document",
                      })
                    }
                    className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)]"
                  >
                    Store (version 1)
                  </button>
                </div>
              </div>
              <ul className="space-y-2">
                {(artifacts.data ?? []).map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedArtifact(a.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-[12px] ${
                        selectedArtifact === a.id
                          ? "border-[var(--color-teal)] bg-[var(--color-teal)]/10"
                          : "border-[var(--color-line)] bg-[var(--color-surface)]"
                      }`}
                    >
                      <p className="font-medium">{a.name}</p>
                      <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                        {a.kind} · {a.contentType}
                      </p>
                    </button>
                  </li>
                ))}
                {(artifacts.data ?? []).length === 0 && (
                  <p className="text-[12px] text-[var(--color-text-muted)]">No artifacts yet.</p>
                )}
              </ul>
            </div>
            <aside className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[11px]">
              <p className="font-semibold">Versions</p>
              {!artifactDetail.data && (
                <p className="mt-2 text-[var(--color-text-muted)]">Select an artifact</p>
              )}
              {artifactDetail.data && (
                <ul className="mt-2 space-y-1">
                  {artifactDetail.data.versions.map((v) => (
                    <li key={v.id} className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                      v{v.version} · {v.storageBackend} · {v.sizeBytes}b · {v.checksumSha256.slice(0, 10)}…
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}

        {tab === "snapshots" && (
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                <h2 className="flex items-center gap-1 text-[12px] font-semibold">
                  <Snowflake size={12} /> Capture from claim
                </h2>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  Runs real `verifyClaim`, updates ledger, freezes snapshot + JSON artifact.
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {(recentClaims.data ?? []).slice(0, 12).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">{c.claimText}</span>
                      <button
                        type="button"
                        disabled={capture.isPending}
                        onClick={() => capture.mutate({ claimId: c.id })}
                        className="shrink-0 rounded border border-[var(--color-line)] px-2 py-0.5 text-[10px]"
                      >
                        Capture
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="space-y-2">
                {(snaps.data ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSnapshot(s.id)}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-[12px] ${
                      selectedSnapshot === s.id
                        ? "border-[var(--color-violet)] bg-[var(--color-violet)]/10"
                        : "border-[var(--color-line)] bg-[var(--color-surface)]"
                    }`}
                  >
                    <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                      {s.verificationStatus} · conf {s.confidenceScore ?? "—"}
                    </p>
                    <p className="text-[var(--color-text-muted)]">{new Date(s.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              {snapDetail.data && (
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[12px]">
                  <p className="font-semibold">Sources (live freshness)</p>
                  <ul className="mt-2 space-y-2">
                    {snapDetail.data.sources.map((s) => (
                      <li key={s.id} className="border-b border-[var(--color-line)]/50 pb-2">
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-teal)] underline"
                        >
                          {s.sourceUrl}
                        </a>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          freshness {(s.freshnessScore * 100).toFixed(0)}% · fetched{" "}
                          {s.fetchedAt ? new Date(s.fetchedAt).toLocaleString() : "—"}
                        </p>
                        {s.supportingSentence && (
                          <p className="mt-1 italic text-[var(--color-text-muted)]">{s.supportingSentence}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl border border-[var(--color-amber)]/40 bg-[var(--color-surface)] p-3 text-[12px]">
                <p className="flex items-center gap-1 font-semibold text-[var(--color-amber)]">
                  <Radar size={12} /> Stale sources (&lt;35% freshness)
                </p>
                <ul className="mt-2 space-y-1">
                  {(stale.data ?? []).slice(0, 15).map((s) => (
                    <li key={s.id} className="truncate font-[var(--font-mono)] text-[10px]">
                      {(s.freshnessScore * 100).toFixed(0)}% · {s.sourceUrl}
                    </li>
                  ))}
                  {(stale.data ?? []).length === 0 && (
                    <li className="text-[var(--color-text-muted)]">None stale (or no sources yet)</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "retrieve" && (
          <div className="mx-auto max-w-2xl space-y-3">
            <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              <Search size={12} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search claims, sources, artifacts…"
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            {retrieve.data && (
              <div className="space-y-3 text-[12px]">
                <section>
                  <h3 className="font-semibold">Claims</h3>
                  <ul className="mt-1 space-y-1">
                    {retrieve.data.claims.map((c) => (
                      <li key={c.id} className="text-[var(--color-text-muted)]">
                        [{c.verificationStatus}] {c.claimText}
                      </li>
                    ))}
                    {!retrieve.data.claims.length && <li className="text-[var(--color-text-muted)]">—</li>}
                  </ul>
                </section>
                <section>
                  <h3 className="font-semibold">Sources</h3>
                  <ul className="mt-1 space-y-1">
                    {retrieve.data.sources.map((s) => (
                      <li key={s.id} className="font-[var(--font-mono)] text-[10px]">
                        {(s.freshnessScore * 100).toFixed(0)}% · {s.sourceUrl}
                      </li>
                    ))}
                    {!retrieve.data.sources.length && <li className="text-[var(--color-text-muted)]">—</li>}
                  </ul>
                </section>
                <section>
                  <h3 className="font-semibold">Artifacts</h3>
                  <ul className="mt-1 space-y-1">
                    {retrieve.data.artifacts.map((a) => (
                      <li key={a.id}>
                        {a.name} · {a.kind}
                      </li>
                    ))}
                    {!retrieve.data.artifacts.length && <li className="text-[var(--color-text-muted)]">—</li>}
                  </ul>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
