import { useEffect, useMemo, useState } from "react";
import { Bot, Play, Plus, FlaskConical } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { TopChrome } from "../../components/TopChrome";

const ROLE_OPTIONS = [
  "researcher",
  "writer",
  "reviewer",
  "coder",
  "qa",
  "publisher",
  "planner",
  "seo",
] as const;

/**
 * Agents workspace — definitions, versions, run, evaluations (Phase 5).
 */
export function AgentsWorkspace() {
  const utils = trpc.useUtils();
  const { data: agents, isLoading, error } = trpc.agents.list.useQuery();
  const usage = trpc.agents.usage.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"run" | "evals" | "usage">("run");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("Research synthesizer");
  const [role, setRole] = useState<string>("researcher");
  const [description, setDescription] = useState("Summarizes research goals into actionable briefs.");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a research synthesizer for WorkerAgent.Cloud. Be concise, cite uncertainty, and never invent sources.",
  );
  const [capabilities, setCapabilities] = useState("research,summarize");
  const [runPrompt, setRunPrompt] = useState("Summarize three angles for a LinkedIn post about AI agents.");
  const [evalName, setEvalName] = useState("Contains actionable steps");
  const [evalInput, setEvalInput] = useState("List 3 concrete next steps for researching AI news.");
  const [evalExpect, setEvalExpect] = useState("1.,2.,3.");
  const [runResult, setRunResult] = useState<string | null>(null);

  const activeId = selectedId ?? agents?.[0]?.id ?? null;
  const detail = trpc.agents.get.useQuery({ agentId: activeId! }, { enabled: Boolean(activeId) });
  const executions = trpc.agents.listExecutions.useQuery(
    { agentId: activeId!, limit: 20 },
    { enabled: Boolean(activeId), refetchInterval: 4000 },
  );
  const evaluations = trpc.agents.listEvaluations.useQuery(
    { agentId: activeId! },
    { enabled: Boolean(activeId) },
  );
  const [evalId, setEvalId] = useState<string | null>(null);
  const activeEvalId = evalId ?? evaluations.data?.[0]?.id ?? null;
  const evalRuns = trpc.agents.listEvaluationRuns.useQuery(
    { evaluationId: activeEvalId! },
    { enabled: Boolean(activeEvalId) },
  );

  useEffect(() => {
    setRunResult(null);
    setMsg(null);
  }, [activeId]);

  const create = trpc.agents.create.useMutation({
    onSuccess: (r) => {
      setSelectedId(r.agentId);
      setShowCreate(false);
      setMsg(`Created agent ${r.agentId.slice(0, 8)}…`);
      void utils.agents.list.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const run = trpc.agents.run.useMutation({
    onSuccess: (r) => {
      setRunResult(r.text);
      setMsg(r.decisionSummary);
      void utils.agents.listExecutions.invalidate();
      void utils.agents.usage.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const setStatus = trpc.agents.setStatus.useMutation({
    onSuccess: () => {
      void utils.agents.list.invalidate();
      void utils.agents.get.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const createEval = trpc.agents.createEvaluation.useMutation({
    onSuccess: (r) => {
      setEvalId(r.evaluationId);
      setMsg(`Evaluation created`);
      void utils.agents.listEvaluations.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });
  const runEval = trpc.agents.runEvaluation.useMutation({
    onSuccess: (r) => {
      setMsg(r.passed ? `Eval passed (score ${r.score.toFixed(2)})` : `Eval failed (score ${r.score.toFixed(2)})`);
      void utils.agents.listEvaluationRuns.invalidate();
      void utils.agents.listExecutions.invalidate();
    },
    onError: (e) => setMsg(e.message),
  });

  const statusLabel = useMemo(() => {
    if (isLoading) return "Loading…";
    if (error) return error.message;
    return `${agents?.length ?? 0} agents · ${usage.data?.count ?? 0} executions`;
  }, [agents, error, isLoading, usage.data]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopChrome
        title="Agents"
        status={statusLabel}
        statusTone="teal"
        actions={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-ink)]"
          >
            <Plus size={12} /> New agent
          </button>
        }
      />

      {msg && (
        <p className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
          {msg}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]/60">
          <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Definitions
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(agents ?? []).length === 0 && !isLoading && (
              <p className="px-3 py-4 text-[12px] text-[var(--color-text-muted)]">
                No agent definitions yet. Create one to bind workflow `agent.task` steps.
              </p>
            )}
            {(agents ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-[var(--color-line)] px-3 py-2.5 text-left ${
                  a.id === activeId ? "bg-[var(--color-teal)]/10" : "hover:bg-[var(--color-ink)]/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                  <Bot size={12} className="text-[var(--color-teal)]" />
                  {a.name}
                </span>
                <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                  {a.role} · {a.status}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showCreate && (
            <div className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="text-[13px] font-semibold">Create agent definition</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] text-[var(--color-text-muted)]">
                  Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="text-[11px] text-[var(--color-text-muted)]">
                  Role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2 text-[11px] text-[var(--color-text-muted)]">
                  Description
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="sm:col-span-2 text-[11px] text-[var(--color-text-muted)]">
                  System prompt
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="text-[11px] text-[var(--color-text-muted)]">
                  Capabilities (comma-separated)
                  <input
                    value={capabilities}
                    onChange={(e) => setCapabilities(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={() =>
                    create.mutate({
                      name,
                      description,
                      role,
                      systemPrompt,
                      capabilities: capabilities
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      activate: true,
                    })
                  }
                  className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)] disabled:opacity-50"
                >
                  {create.isPending ? "Creating…" : "Create & activate"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!activeId && (
            <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-[var(--color-text-muted)]">
              Select or create an agent definition.
            </div>
          )}

          {activeId && detail.data && (
            <>
              <div className="shrink-0 border-b border-[var(--color-line)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[16px] font-semibold">{detail.data.name}</h2>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{detail.data.description}</p>
                    <p className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">
                      {detail.data.role} · {detail.data.status} · v
                      {detail.data.versions[0]?.version ?? "?"} ·{" "}
                      {detail.data.modelPolicy.preferredModel ?? "router default"}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                      Capabilities: {detail.data.capabilities.join(", ") || "—"} · Tools:{" "}
                      {detail.data.allowedTools.join(", ") || "none"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(["active", "draft", "disabled"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={setStatus.isPending || detail.data.status === s}
                        onClick={() => setStatus.mutate({ agentId: activeId, status: s })}
                        className={`rounded-lg px-2 py-1 text-[10px] ${
                          detail.data.status === s
                            ? "bg-[var(--color-teal)]/20 text-[var(--color-teal)]"
                            : "border border-[var(--color-line)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {(
                    [
                      ["run", "Run"],
                      ["evals", "Evaluations"],
                      ["usage", "Usage"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] ${
                        tab === id
                          ? "bg-[var(--color-violet)] text-white"
                          : "border border-[var(--color-line)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "run" && (
                  <div className="mx-auto max-w-3xl space-y-4">
                    <label className="block text-[11px] text-[var(--color-text-muted)]">
                      Prompt
                      <textarea
                        value={runPrompt}
                        onChange={(e) => setRunPrompt(e.target.value)}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={run.isPending}
                      onClick={() => run.mutate({ agentId: activeId, prompt: runPrompt })}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)] disabled:opacity-50"
                    >
                      <Play size={12} /> {run.isPending ? "Running…" : "Run agent"}
                    </button>
                    {runResult && (
                      <pre className="whitespace-pre-wrap rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[12px]">
                        {runResult}
                      </pre>
                    )}
                    <div>
                      <h3 className="text-[12px] font-semibold">Recent executions</h3>
                      <ul className="mt-2 space-y-2">
                        {(executions.data ?? []).map((ex) => (
                          <li
                            key={ex.id}
                            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-[var(--font-mono)] text-[var(--color-teal)]">
                                {ex.status} · {ex.modelProvider}/{ex.modelName}
                              </span>
                              <span className="text-[var(--color-text-muted)]">
                                {new Date(ex.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-1 text-[var(--color-text-muted)]">{ex.decisionSummary}</p>
                            {ex.outputPreview && (
                              <p className="mt-1 line-clamp-2 text-[var(--color-text-primary)]">
                                {ex.outputPreview}
                              </p>
                            )}
                            {ex.error && <p className="mt-1 text-[var(--color-amber)]">{ex.error}</p>}
                          </li>
                        ))}
                        {(executions.data ?? []).length === 0 && (
                          <p className="text-[12px] text-[var(--color-text-muted)]">No executions yet.</p>
                        )}
                      </ul>
                    </div>
                    <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                      <summary className="cursor-pointer text-[12px] font-semibold">System prompt</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] text-[var(--color-text-muted)]">
                        {detail.data.systemPrompt}
                      </pre>
                    </details>
                  </div>
                )}

                {tab === "evals" && (
                  <div className="mx-auto max-w-3xl space-y-4">
                    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                      <h3 className="flex items-center gap-1 text-[12px] font-semibold">
                        <FlaskConical size={12} /> New evaluation
                      </h3>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-[var(--color-text-muted)]">
                          Name
                          <input
                            value={evalName}
                            onChange={(e) => setEvalName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                          />
                        </label>
                        <label className="text-[11px] text-[var(--color-text-muted)]">
                          Expect contains (comma-separated)
                          <input
                            value={evalExpect}
                            onChange={(e) => setEvalExpect(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                          />
                        </label>
                        <label className="sm:col-span-2 text-[11px] text-[var(--color-text-muted)]">
                          Input prompt
                          <textarea
                            value={evalInput}
                            onChange={(e) => setEvalInput(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={createEval.isPending}
                        onClick={() =>
                          createEval.mutate({
                            agentId: activeId,
                            name: evalName,
                            input: evalInput,
                            expectContains: evalExpect
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mt-2 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[11px]"
                      >
                        Add evaluation
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(evaluations.data ?? []).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setEvalId(ev.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${
                            ev.id === activeEvalId
                              ? "bg-[var(--color-violet)] text-white"
                              : "border border-[var(--color-line)]"
                          }`}
                        >
                          {ev.name}
                        </button>
                      ))}
                    </div>

                    {activeEvalId && (
                      <div>
                        <button
                          type="button"
                          disabled={runEval.isPending}
                          onClick={() => runEval.mutate({ evaluationId: activeEvalId })}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink)] disabled:opacity-50"
                        >
                          <Play size={12} /> {runEval.isPending ? "Scoring…" : "Run evaluation"}
                        </button>
                        <ul className="mt-3 space-y-2">
                          {(evalRuns.data ?? []).map((r) => (
                            <li
                              key={r.id}
                              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[11px]"
                            >
                              <span className={r.passed ? "text-[var(--color-teal)]" : "text-[var(--color-amber)]"}>
                                {r.passed ? "PASS" : "FAIL"} · score {r.score}
                              </span>
                              <span className="ml-2 text-[var(--color-text-muted)]">
                                {new Date(r.createdAt).toLocaleString()}
                              </span>
                            </li>
                          ))}
                          {(evalRuns.data ?? []).length === 0 && (
                            <p className="text-[12px] text-[var(--color-text-muted)]">No runs yet.</p>
                          )}
                        </ul>
                      </div>
                    )}
                    {(evaluations.data ?? []).length === 0 && (
                      <p className="text-[12px] text-[var(--color-text-muted)]">
                        No evaluations for this agent yet.
                      </p>
                    )}
                  </div>
                )}

                {tab === "usage" && (
                  <div className="mx-auto max-w-xl space-y-3">
                    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                      <h3 className="text-[12px] font-semibold">Org usage</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                        <div>
                          <dt className="text-[var(--color-text-muted)]">Executions</dt>
                          <dd className="font-[var(--font-mono)]">{usage.data?.count ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--color-text-muted)]">Completed</dt>
                          <dd className="font-[var(--font-mono)]">{usage.data?.completed ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--color-text-muted)]">Failed</dt>
                          <dd className="font-[var(--font-mono)]">{usage.data?.failed ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--color-text-muted)]">Tokens in/out</dt>
                          <dd className="font-[var(--font-mono)]">
                            {usage.data?.inputTokens ?? 0} / {usage.data?.outputTokens ?? 0}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                        Counts come from real `agent_executions` rows — not estimated dashboards.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[12px] font-semibold">Versions</h3>
                      <ul className="mt-2 space-y-1">
                        {detail.data.versions.map((v) => (
                          <li key={v.id} className="font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
                            v{v.version} · {v.changeSummary ?? "—"} · {new Date(v.createdAt).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeId && detail.isError && (
            <div className="p-4 text-[12px] text-[var(--color-amber)]">{detail.error.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
