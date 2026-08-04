import { useEffect, useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";
import { ScriptEditor } from "./ScriptEditor";
import { useWorkspaceNav } from "../../components/WorkspaceNavContext";

/**
 * Loads real scripts from the API. God Machine writer drafts land here via
 * the Content Ops pipeline (focusScriptId from workspace nav).
 */
export function ScriptStudioWorkspace() {
  const utils = trpc.useUtils();
  const nav = useWorkspaceNav();
  const { data: scripts, isLoading, isError, error } = trpc.script.list.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled script");

  useEffect(() => {
    if (nav.focusScriptId) setSelectedId(nav.focusScriptId);
  }, [nav.focusScriptId]);

  const create = trpc.script.create.useMutation({
    onSuccess: async (created) => {
      await utils.script.list.invalidate();
      setSelectedId(created.id);
      nav.setFocusScriptId(created.id);
      setTitle("Untitled script");
      // Ensure pipeline exists for handoff chain
      void utils.pipeline.getActive.invalidate();
    },
  });
  const ensurePipe = trpc.pipeline.create.useMutation({
    onSuccess: () => utils.pipeline.getActive.invalidate(),
  });

  const activeId = selectedId ?? nav.focusScriptId ?? scripts?.[0]?.id ?? null;

  const {
    data: script,
    isLoading: loadingScript,
    isError: scriptError,
    error: scriptErr,
  } = trpc.script.getById.useQuery({ scriptId: activeId! }, { enabled: Boolean(activeId) });

  const initialSections = useMemo(() => script?.sections ?? [], [script]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-[var(--color-violet)]/30 bg-[var(--color-violet)]/5 px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
        After review, use <span className="text-[var(--color-violet)]">Advance →</span> in the pipeline bar to send
        this script to Evidence → Research-to-Post → Workspace → Autopilot → Social → Approvals → Publishing.
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Open script
          <select
            value={activeId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedId(id);
              nav.setFocusScriptId(id);
            }}
            disabled={isLoading || !scripts?.length}
            className="rounded border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-2 py-2 text-sm text-[var(--color-text-primary)]"
          >
            {!scripts?.length && <option value="">No scripts yet</option>}
            {scripts?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          New title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-2 py-2 text-sm text-[var(--color-text-primary)]"
          />
        </label>

        <button
          type="button"
          disabled={create.isPending || title.trim().length === 0}
          onClick={() =>
            create.mutate(
              { title: title.trim(), targetDurationSeconds: 60 },
              {
                onSuccess: (created) => {
                  ensurePipe.mutate({ title: created.title, scriptId: created.id, stage: "script_studio" });
                },
              },
            )
          }
          className="rounded bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "New script"}
        </button>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">Loading scripts…</p>}
      {isError && <p className="text-sm text-[var(--color-coral)]">Couldn't list scripts: {error.message}</p>}
      {create.isError && <p className="text-sm text-[var(--color-coral)]">{create.error.message}</p>}

      {!isLoading && !scripts?.length && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Ask God Machine to generate a script, or create one here. Writer drafts auto-land in Script Studio.
        </p>
      )}

      {activeId && loadingScript && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading script…</p>
      )}
      {scriptError && (
        <p className="text-sm text-[var(--color-coral)]">Couldn't load script: {scriptErr.message}</p>
      )}

      {script && (
        <>
          <h2 className="font-[var(--font-display)] text-sm tracking-wide text-[var(--color-text-primary)]">
            {script.title}
          </h2>
          <ScriptEditor
            key={`${script.id}-${script.updatedAt}`}
            scriptId={script.id}
            targetDurationSeconds={script.targetDurationSeconds}
            initialSections={initialSections}
          />
        </>
      )}
    </div>
  );
}
