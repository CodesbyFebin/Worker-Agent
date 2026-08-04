import { trpc } from "../../lib/trpc";
import type { ClaimVerificationStatus } from "../../../../shared/types";

const STATUS_STYLES: Record<ClaimVerificationStatus, string> = {
  pending: "text-[var(--color-amber)] border-[var(--color-amber)]",
  verified: "text-[var(--color-teal)] border-[var(--color-teal)]",
  rejected: "text-[var(--color-coral)] border-[var(--color-coral)]",
  unverifiable: "text-[var(--color-text-muted)] border-[var(--color-line)]",
};

const STATUS_OPTIONS: ClaimVerificationStatus[] = ["pending", "verified", "rejected", "unverifiable"];

export function LedgerExplorer({ scriptId }: { scriptId: string }) {
  const utils = trpc.useUtils();
  const { data: claims, isLoading, isError, error } = trpc.ledger.listByScript.useQuery({ scriptId });
  const setStatus = trpc.ledger.setStatus.useMutation({
    onSuccess: () => utils.ledger.listByScript.invalidate({ scriptId }),
  });
  const verifyClaim = trpc.ledger.verifyClaim.useMutation({
    onSuccess: () => utils.ledger.listByScript.invalidate({ scriptId }),
  });

  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading claim ledger…</p>;
  if (isError) return <p className="text-sm text-[var(--color-coral)]">Couldn't load ledger: {error.message}</p>;
  if (!claims || claims.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No claims logged for this script yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2">Devtag</th>
            <th className="px-3 py-2">Claim</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {claims.map((claim) => (
            <tr key={claim.id} className="bg-[var(--color-surface-raised)]">
              <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{claim.devtag}</td>
              <td className="px-3 py-2 text-[var(--color-text-primary)]">{claim.claimText}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">
                {claim.confidenceScore != null ? claim.confidenceScore.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLES[claim.verificationStatus]}`}>
                    {claim.verificationStatus}
                  </span>
                  {claim.sourceUrl && (
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[var(--color-teal)] underline"
                    >
                      source
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={verifyClaim.isPending}
                    onClick={() => verifyClaim.mutate({ claimId: claim.id })}
                    title="Run real web search + fetch against this claim"
                    className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    {verifyClaim.isPending ? "verifying…" : "verify"}
                  </button>
                  {/* Manual override — a human can mark a claim "unverifiable" when no
                      real source can settle it, rather than being forced into verified/rejected. */}
                  <select
                    value=""
                    disabled={setStatus.isPending}
                    onChange={(e) => {
                      const next = e.target.value as ClaimVerificationStatus;
                      if (next) setStatus.mutate({ claimId: claim.id, status: next });
                    }}
                    className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-1 py-0.5 text-[11px] text-[var(--color-text-muted)]"
                  >
                    <option value="">override…</option>
                    {STATUS_OPTIONS.filter((s) => s !== claim.verificationStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
