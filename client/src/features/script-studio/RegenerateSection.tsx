import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { ScriptSectionDTO } from "../../../../shared/types";

interface RegenerateSectionProps {
  section: ScriptSectionDTO;
  onRegenerated: (updated: ScriptSectionDTO) => void;
}

export function RegenerateSection({ section, onRegenerated }: RegenerateSectionProps) {
  const [instruction, setInstruction] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);

  const regenerate = trpc.script.regenerateSection.useMutation({
    onSuccess: (result) => {
      onRegenerated({ ...section, ...result });
      setOpen(false);
      setInstruction("");
    },
  });

  const save = trpc.script.updateSection.useMutation({
    onSuccess: (result) => {
      onRegenerated(result);
      setEditing(false);
      setDraft(result.content);
    },
  });

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{section.kind}</span>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
              {section.content || <span className="text-[var(--color-text-muted)]">(empty)</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {editing ? (
            <>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate({ sectionId: section.id, content: draft })}
                className="rounded bg-[var(--color-text-primary)] px-2 py-1 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(section.content);
                }}
                className="rounded border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(section.content);
                  setEditing(true);
                }}
                className="rounded border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {open && !editing && (
        <div className="mt-3 flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "make it more urgent"'
            className="flex-1 rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
          <button
            type="button"
            disabled={regenerate.isPending}
            onClick={() =>
              regenerate.mutate({
                sectionId: section.id,
                instruction: instruction.trim() || undefined,
              })
            }
            className="rounded bg-[var(--color-text-primary)] px-3 py-1 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            {regenerate.isPending ? "Rewriting…" : "Rewrite"}
          </button>
        </div>
      )}

      {regenerate.isError && (
        <p className="mt-2 text-xs text-[var(--color-coral)]">
          Couldn't regenerate this section: {regenerate.error.message}
        </p>
      )}
      {save.isError && (
        <p className="mt-2 text-xs text-[var(--color-coral)]">Couldn't save: {save.error.message}</p>
      )}
    </div>
  );
}
