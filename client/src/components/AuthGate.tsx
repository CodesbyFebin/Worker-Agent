import { useState, type ReactNode } from "react";
import { trpc } from "../lib/trpc";

/**
 * Blocks the app until a real session exists.
 * Development login is explicitly labeled — not production auth.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [email, setEmail] = useState("local-dev-user@local.dev");
  const [displayName, setDisplayName] = useState("Local Dev User");
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  if (me.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-ink)] text-[var(--color-text-muted)]">
        Checking session…
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--color-ink)] px-6 text-center">
        <p className="text-[var(--color-coral)]">Could not reach API</p>
        <p className="text-[12px] text-[var(--color-text-muted)]">{me.error.message}</p>
        <button
          type="button"
          className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px]"
          onClick={() => void me.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!me.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-ink)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--glow-magenta)]">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-violet)]">
            Development only
          </p>
          <h1 className="mt-2 text-[22px] font-semibold text-[var(--color-text-primary)]">
            WorkerAgent.Cloud
          </h1>
          <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
            Sign in creates a real httpOnly session, personal organization, and RBAC membership.
            The old <code className="text-[var(--color-teal)]">x-user-id</code> header is no longer
            trusted.
          </p>
          <label className="mt-4 block text-[11px] text-[var(--color-text-muted)]">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
            />
          </label>
          {error && <p className="mt-3 text-[12px] text-[var(--color-coral)]">{error}</p>}
          <button
            type="button"
            disabled={login.isPending}
            onClick={() => login.mutate({ email, displayName })}
            className="mt-4 w-full rounded-xl bg-[var(--color-violet)] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {login.isPending ? "Signing in…" : "Dev login"}
          </button>
          <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
            Disabled when <code>NODE_ENV=production</code>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
