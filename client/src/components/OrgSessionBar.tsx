import { trpc } from "../lib/trpc";

/** Active organization + logout — session cookie auth. */
export function OrgSessionBar() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const switchOrg = trpc.auth.switchOrganization.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.reload();
    },
  });

  if (!me.data) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[11px]">
      <span className="text-[var(--color-text-muted)]">Org</span>
      <select
        className="max-w-[180px] truncate rounded-md border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[11px]"
        value={me.data.organizationId ?? ""}
        disabled={switchOrg.isPending}
        onChange={(e) => {
          if (e.target.value) switchOrg.mutate({ organizationId: e.target.value });
        }}
      >
        {(me.data.organizations ?? []).map((o) => (
          <option key={o.organizationId} value={o.organizationId}>
            {o.name} ({o.roleSlug})
          </option>
        ))}
      </select>
      <span className="truncate text-[var(--color-text-muted)]" title={me.data.email ?? undefined}>
        {me.data.displayName ?? me.data.email}
      </span>
      {me.data.developmentAuth && (
        <span className="rounded bg-[var(--color-violet)]/20 px-1.5 py-0.5 text-[10px] text-[var(--color-violet)]">
          DEV AUTH
        </span>
      )}
      <button
        type="button"
        className="ml-auto rounded border border-[var(--color-line)] px-2 py-0.5 hover:bg-[var(--color-surface-raised)]"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        Log out
      </button>
    </div>
  );
}
