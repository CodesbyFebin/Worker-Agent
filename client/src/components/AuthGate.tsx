import { useState, type ReactNode } from "react";
import { trpc } from "../lib/trpc";

const isProduction = import.meta.env.MODE === "production";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "dev">("login");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const devMutation = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const isPending = loginMutation.isPending || devMutation.isPending;

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
    const submit = () => {
      setError(null);
      if (mode === "login") {
        loginMutation.mutate({ email, password });
      } else {
        devMutation.mutate({ email, displayName: email });
      }
    };

    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-ink)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--glow-magenta)]">
          <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)]">
            WorkerAgent.Cloud
          </h1>
          <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
            {isProduction
              ? "Sign in with your production credentials to access Mission Control."
              : "Sign in creates a real httpOnly session, personal organization, and RBAC membership."}
          </p>

          {!isProduction && (
            <div className="mt-4 flex rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold ${mode === "login" ? "bg-[var(--color-violet)] text-white" : "text-[var(--color-text-muted)]"}`}
              >
                Production
              </button>
              <button
                type="button"
                onClick={() => setMode("dev")}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold ${mode === "dev" ? "bg-[var(--color-violet)] text-white" : "text-[var(--color-text-muted)]"}`}
              >
                Development
              </button>
            </div>
          )}

          {mode === "login" ? (
            <>
              <label className="mt-4 block text-[11px] text-[var(--color-text-muted)]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
                  placeholder="you@company.com"
                />
              </label>
              <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
                  placeholder="••••••••"
                />
              </label>
              {error && <p className="mt-3 text-[12px] text-[var(--color-coral)]">{error}</p>}
              <button
                type="button"
                disabled={isPending || !email || !password}
                onClick={submit}
                className="mt-4 w-full rounded-xl bg-[var(--color-violet)] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {isPending ? "Signing in…" : "Sign in"}
              </button>
              <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                Password reset is not configured.
              </p>
            </>
          ) : (
            <>
              <label className="mt-4 block text-[11px] text-[var(--color-text-muted)]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
                />
              </label>
              <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
                Display name
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[13px]"
                />
              </label>
              {error && <p className="mt-3 text-[12px] text-[var(--color-coral)]">{error}</p>}
              <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
                Development login is disabled when <code>NODE_ENV=production</code>.
              </p>
              <button
                type="button"
                disabled={isPending || !email}
                onClick={submit}
                className="mt-4 w-full rounded-xl bg-[var(--color-violet)] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {isPending ? "Signing in…" : "Dev login"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
