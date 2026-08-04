import type { WorkflowNode, ErrorStrategy } from "../workflowGraph";

type Props = {
  node: WorkflowNode | null;
  runOutput?: unknown;
  runDecision?: string | null;
  runError?: string | null;
  onChange: (node: WorkflowNode) => void;
  onDelete: () => void;
};

export function NodeInspector({ node, runOutput, runDecision, runError, onChange, onDelete }: Props) {
  if (!node) {
    return (
      <div className="p-4 text-[12px] text-[var(--color-text-muted)]">
        Select a node to inspect settings, or click a step during run replay to see its execution record.
      </div>
    );
  }

  function patch(partial: Partial<WorkflowNode>) {
    onChange({ ...node!, ...partial });
  }

  function patchConfig(key: string, value: unknown) {
    patch({ config: { ...node!.config, [key]: value } });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Inspector</p>
      <h3 className="mt-1 text-[14px] font-semibold">{node.name}</h3>
      <p className="font-[var(--font-mono)] text-[10px] text-[var(--color-teal)]">{node.type}</p>

      <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
        Name
        <input
          value={node.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
        />
      </label>

      {node.type === "agent.task" && (
        <>
          <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
            Prompt
            <textarea
              value={String(node.config.prompt ?? "")}
              onChange={(e) => patchConfig("prompt", e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
            />
          </label>
          <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
            Agent definition ID (optional)
            <input
              value={String(node.config.agentDefinitionId ?? "")}
              onChange={(e) => patchConfig("agentDefinitionId", e.target.value || undefined)}
              placeholder="UUID from Agents workspace"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
            />
          </label>
          <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
            Agent role fallback
            <input
              value={String(node.config.agentRole ?? "")}
              onChange={(e) => patchConfig("agentRole", e.target.value || undefined)}
              placeholder="e.g. researcher"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
            />
          </label>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            Resolves active org agent by role when ID is empty; otherwise runs an ephemeral agent and still records `agent_executions`.
          </p>
        </>
      )}

      {node.type === "logic.condition" && (
        <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
          Expression
          <input
            value={String(node.config.expression ?? "true")}
            onChange={(e) => patchConfig("expression", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          />
        </label>
      )}

      {node.type === "logic.delay" && (
        <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
          Delay (ms)
          <input
            type="number"
            value={Number(node.config.delayMs ?? 0)}
            onChange={(e) => patchConfig("delayMs", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          />
        </label>
      )}

      {node.type === "human.approval" && (
        <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
          Approval summary
          <textarea
            value={String(node.config.summary ?? "")}
            onChange={(e) => patchConfig("summary", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          />
        </label>
      )}

      {node.type === "logic.transform" && (
        <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
          Template JSON
          <textarea
            value={JSON.stringify(node.config.template ?? {}, null, 2)}
            onChange={(e) => {
              try {
                patchConfig("template", JSON.parse(e.target.value));
              } catch {
                /* keep typing */
              }
            }}
            rows={6}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 font-[var(--font-mono)] text-[11px]"
          />
        </label>
      )}

      {node.type === "output.notify" && (
        <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
          Message
          <textarea
            value={String(node.config.message ?? "")}
            onChange={(e) => patchConfig("message", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
          />
        </label>
      )}

      <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
        Error strategy
        <select
          value={node.errorStrategy ?? "stop_workflow"}
          onChange={(e) => patch({ errorStrategy: e.target.value as ErrorStrategy })}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
        >
          <option value="stop_workflow">Stop workflow</option>
          <option value="retry">Retry</option>
          <option value="retry_with_backoff">Retry with backoff</option>
          <option value="continue">Continue</option>
          <option value="skip">Skip</option>
          <option value="request_human_input">Request human input</option>
        </select>
      </label>

      <label className="mt-3 block text-[11px] text-[var(--color-text-muted)]">
        Max attempts
        <input
          type="number"
          min={1}
          max={10}
          value={node.maxAttempts ?? 3}
          onChange={(e) => patch({ maxAttempts: Number(e.target.value) })}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-[12px]"
        />
      </label>

      <label className="mt-3 flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={Boolean(node.requiresApproval || node.type === "human.approval")}
          onChange={(e) => patch({ requiresApproval: e.target.checked })}
        />
        Requires approval
      </label>

      {(runDecision || runError || runOutput != null) && (
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-2">
          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Last execution</p>
          {runDecision && <p className="mt-1 text-[11px] text-[var(--color-teal)]">{runDecision}</p>}
          {runError && <p className="mt-1 text-[11px] text-[var(--color-coral)]">{runError}</p>}
          {runOutput != null && (
            <pre className="mt-2 max-h-40 overflow-auto text-[10px]">
              {JSON.stringify(runOutput, null, 2)}
            </pre>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="mt-4 rounded-lg border border-[var(--color-coral)]/50 px-3 py-1.5 text-[12px] text-[var(--color-coral)]"
      >
        Delete node
      </button>
    </div>
  );
}
