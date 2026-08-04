import { useMemo, useState } from "react";
import { Wrench, Server, Shield, KeyRound, Play } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

type Tab = "tools" | "mcp" | "policy" | "credentials" | "invocations";

/**
 * Tool Gateway & MCP — real invoke/discover/policy/credential refs (Phase 7).
 */
export function ToolsGatewayWorkspace() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("tools");
  const [msg, setMsg] = useState<string | null>(null);

  const tools = trpc.tools.list.useQuery();
  const invocations = trpc.tools.listInvocations.useQuery({ limit: 30 }, { refetchInterval: 4000 });
  const mcp = trpc.tools.listMcpServers.useQuery();
  const policy = trpc.tools.getPolicy.useQuery();
  const creds = trpc.tools.listCredentials.useQuery();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState("{}");
  const [invokeOut, setInvokeOut] = useState<string | null>(null);

  const [mcpName, setMcpName] = useState("Local MCP HTTP");
  const [mcpEndpoint, setMcpEndpoint] = useState("http://127.0.0.1:3001/mcp");
  const [mcpTransport, setMcpTransport] = useState<"http" | "stdio">("http");

  const [allowedTools, setAllowedTools] = useState("");
  const [deniedTools, setDeniedTools] = useState("");
  const [allowedMcp, setAllowedMcp] = useState("");

  const [credName, setCredName] = useState("OpenRouter");
  const [credProvider, setCredProvider] = useState("openrouter");
  const [credEnv, setCredEnv] = useState("OPENROUTER_API_KEY");

  const activeTool = useMemo(
    () => (tools.data ?? []).find((t) => t.name === (selectedTool ?? tools.data?.[0]?.name)) ?? null,
    [tools.data, selectedTool],
  );

  const invoke = trpc.tools.invoke.useMutation({
    onSuccess: (r) => {
      setInvokeOut(JSON.stringify(r, null, 2));
      setMsg(`${r.status} · ${r.durationMs}ms`);
      void utils.tools.listInvocations.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const registerMcp = trpc.tools.registerMcpServer.useMutation({
    onSuccess: () => {
      setMsg("MCP server registered");
      void utils.tools.listMcpServers.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const discover = trpc.tools.discoverMcp.useMutation({
    onSuccess: (r) => {
      setMsg(`Discovered ${r.discovered} tools`);
      void utils.tools.list.invalidate();
      void utils.tools.listMcpServers.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const setEnabled = trpc.tools.setMcpEnabled.useMutation({
    onSuccess: () => void utils.tools.listMcpServers.invalidate(),
  });
  const setPolicy = trpc.tools.setPolicy.useMutation({
    onSuccess: () => {
      setMsg("Policy saved");
      void utils.tools.getPolicy.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const createCred = trpc.tools.createCredential.useMutation({
    onSuccess: (r) => {
      setMsg(`Credential ref created · env ${r.configured ? "present" : "missing"}`);
      void utils.tools.listCredentials.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const seed = trpc.tools.seedBuiltins.useMutation({
    onSuccess: () => {
      setMsg("Builtin tools seeded");
      void utils.tools.list.invalidate();
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Tool Gateway & MCP"
        status={`${tools.data?.length ?? 0} tools · ${mcp.data?.length ?? 0} MCP`}
        statusTone="violet"
        actions={
          <button
            type="button"
            onClick={() => seed.mutate()}
            className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[11px]"
          >
            Seed builtins
          </button>
        }
      />
      {msg && (
        <p className="shrink-0 border-b border-[var(--color-line)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
          {msg}
        </p>
      )}

      <div className="flex gap-1 border-b border-[var(--color-line)] px-3 py-2">
        {(
          [
            ["tools", "Tools", Wrench],
            ["mcp", "MCP registry", Server],
            ["policy", "Policies", Shield],
            ["credentials", "Credentials", KeyRound],
            ["invocations", "Invocations", Play],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] ${
              tab === id ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)]"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "tools" && (
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-1">
              {(tools.data ?? []).length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  No tools yet — click Seed builtins.
                </p>
              )}
              {(tools.data ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTool(t.name)}
                  className={`block w-full rounded-lg border px-2 py-2 text-left ${
                    activeTool?.name === t.name
                      ? "border-[var(--color-violet)] bg-[var(--color-violet)]/10"
                      : "border-[var(--color-line)] bg-[var(--color-surface)]"
                  }`}
                >
                  <p className="text-[12px] font-medium">{t.displayName}</p>
                  <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">{t.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {t.source}
                    {!t.credentialConfigured ? " · cred missing" : ""}
                  </p>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {activeTool ? (
                <>
                  <h2 className="text-[14px] font-semibold">{activeTool.displayName}</h2>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{activeTool.description}</p>
                  <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                    permission={activeTool.requiredPermission}
                  </p>
                  <label className="block text-[11px] text-[var(--color-text-muted)]">
                    Input JSON
                    <textarea
                      value={toolInput}
                      onChange={(e) => setToolInput(e.target.value)}
                      rows={6}
                      className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={invoke.isPending}
                    onClick={() => {
                      let parsed: Record<string, unknown> = {};
                      try {
                        parsed = JSON.parse(toolInput) as Record<string, unknown>;
                      } catch {
                        setMsg("Invalid JSON input");
                        return;
                      }
                      invoke.mutate({ toolName: activeTool.name, input: parsed });
                    }}
                    className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)] disabled:opacity-50"
                  >
                    {invoke.isPending ? "Invoking…" : "Invoke via gateway"}
                  </button>
                  {invokeOut && (
                    <pre className="max-h-80 overflow-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[11px]">
                      {invokeOut}
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[var(--color-text-muted)]">Select a tool</p>
              )}
            </div>
          </div>
        )}

        {tab === "mcp" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="text-[13px] font-semibold">Register MCP server</h2>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                HTTP: JSON-RPC `tools/list` + `tools/call`. Stdio: provide `config.tools[]` catalog for
                discovery (live stdio spawn later).
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] text-[var(--color-text-muted)]">
                  Name
                  <input
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="text-[11px] text-[var(--color-text-muted)]">
                  Transport
                  <select
                    value={mcpTransport}
                    onChange={(e) => setMcpTransport(e.target.value as "http" | "stdio")}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  >
                    <option value="http">http</option>
                    <option value="stdio">stdio</option>
                  </select>
                </label>
                <label className="sm:col-span-2 text-[11px] text-[var(--color-text-muted)]">
                  Endpoint / command
                  <input
                    value={mcpEndpoint}
                    onChange={(e) => setMcpEndpoint(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={registerMcp.isPending}
                onClick={() =>
                  registerMcp.mutate({
                    name: mcpName,
                    transport: mcpTransport,
                    endpoint: mcpEndpoint,
                  })
                }
                className="mt-3 rounded-lg bg-[var(--color-violet)] px-3 py-1.5 text-[11px] text-white disabled:opacity-50"
              >
                Register
              </button>
            </div>

            {(mcp.data ?? []).length === 0 && (
              <p className="text-[12px] text-[var(--color-text-muted)]">No MCP servers registered.</p>
            )}
            <ul className="space-y-2">
              {(mcp.data ?? []).map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[12px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                        {s.transport} · {s.endpoint}
                      </p>
                      {s.lastError && (
                        <p className="mt-1 text-[11px] text-[var(--color-amber)]">{s.lastError}</p>
                      )}
                      {s.lastDiscoveredAt && (
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          discovered {new Date(s.lastDiscoveredAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={discover.isPending}
                        onClick={() => discover.mutate({ serverId: s.id })}
                        className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px]"
                      >
                        Discover
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnabled.mutate({ serverId: s.id, enabled: !s.enabled })}
                        className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px]"
                      >
                        {s.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "policy" && (
          <div className="mx-auto max-w-xl space-y-3">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Default gateway policy. Empty MCP allow-list = all enabled MCP servers. Denied tools always
              block. Builtins are allowed unless denied.
            </p>
            <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
              current allowed={policy.data?.allowedTools.join(",") || "(all builtins)"} denied=
              {policy.data?.deniedTools.join(",") || "(none)"} mcp=
              {policy.data?.allowedMcpServerIds.join(",") || "(all enabled)"}
            </p>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Allowed tools (comma-separated; for MCP filter)
              <input
                value={allowedTools}
                onChange={(e) => setAllowedTools(e.target.value)}
                placeholder={policy.data?.allowedTools.join(",") ?? ""}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Denied tools
              <input
                value={deniedTools}
                onChange={(e) => setDeniedTools(e.target.value)}
                placeholder={policy.data?.deniedTools.join(",") ?? ""}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block text-[11px] text-[var(--color-text-muted)]">
              Allowed MCP server UUIDs
              <input
                value={allowedMcp}
                onChange={(e) => setAllowedMcp(e.target.value)}
                placeholder={policy.data?.allowedMcpServerIds.join(",") ?? ""}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <button
              type="button"
              disabled={setPolicy.isPending}
              onClick={() =>
                setPolicy.mutate({
                  allowedTools: allowedTools
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  deniedTools: deniedTools
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  allowedMcpServerIds: allowedMcp
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="rounded-lg bg-[var(--color-violet)] px-3 py-1.5 text-[11px] text-white"
            >
              Save policy
            </button>
          </div>
        )}

        {tab === "credentials" && (
          <div className="mx-auto max-w-xl space-y-4">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Credential refs store env key names only — never secret values. Presence is checked at
              invoke time.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-[var(--color-text-muted)]">
                Name
                <input
                  value={credName}
                  onChange={(e) => setCredName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                />
              </label>
              <label className="text-[11px] text-[var(--color-text-muted)]">
                Provider
                <input
                  value={credProvider}
                  onChange={(e) => setCredProvider(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                />
              </label>
              <label className="sm:col-span-2 text-[11px] text-[var(--color-text-muted)]">
                Env key
                <input
                  value={credEnv}
                  onChange={(e) => setCredEnv(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={createCred.isPending}
              onClick={() =>
                createCred.mutate({
                  name: credName,
                  provider: credProvider,
                  envKey: credEnv,
                })
              }
              className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)]"
            >
              Add credential ref
            </button>
            <ul className="space-y-2">
              {(creds.data ?? []).map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[12px]"
                >
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                    {c.envKey}
                  </span>
                  <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                    {c.configured ? "env set" : "env missing"}
                  </span>
                </li>
              ))}
              {(creds.data ?? []).length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">No credential refs yet.</p>
              )}
            </ul>
          </div>
        )}

        {tab === "invocations" && (
          <div className="mx-auto max-w-3xl">
            <ul className="space-y-2">
              {(invocations.data ?? []).map((i) => (
                <li
                  key={i.id}
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-[var(--font-mono)] text-[var(--color-teal)]">{i.toolName}</span>
                    <span>
                      {i.status}
                      {i.durationMs != null ? ` · ${i.durationMs}ms` : ""}
                    </span>
                  </div>
                  {i.error && <p className="mt-1 text-[var(--color-amber)]">{i.error}</p>}
                  {i.outputPreview && (
                    <p className="mt-1 line-clamp-2 text-[var(--color-text-muted)]">{i.outputPreview}</p>
                  )}
                </li>
              ))}
              {(invocations.data ?? []).length === 0 && (
                <p className="text-[12px] text-[var(--color-text-muted)]">No invocations yet.</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
