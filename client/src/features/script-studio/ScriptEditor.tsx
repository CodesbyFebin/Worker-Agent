import { useEffect, useState } from "react";
import { ScriptTelemetry } from "./ScriptTelemetry";
import { RegenerateSection } from "./RegenerateSection";
import { MetadataGenerator } from "./MetadataGenerator";
import { trpc } from "../../lib/trpc";
import type { ScriptSectionDTO } from "../../../../shared/types";

interface ScriptEditorProps {
  scriptId: string;
  targetDurationSeconds: number;
  initialSections: ScriptSectionDTO[];
  onSectionsChange?: (sections: ScriptSectionDTO[]) => void;
}

export function ScriptEditor({
  scriptId,
  targetDurationSeconds,
  initialSections,
  onSectionsChange,
}: ScriptEditorProps) {
  const [sections, setSections] = useState(initialSections);
  const utils = trpc.useUtils();
  const extractClaims = trpc.ledger.extractAndLog.useMutation({
    onSuccess: () => utils.ledger.listByScript.invalidate({ scriptId }),
  });

  useEffect(() => {
    setSections(initialSections);
  }, [scriptId, initialSections]);

  const fullText = sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.content)
    .join("\n\n");

  function handleSectionUpdate(updated: ScriptSectionDTO) {
    setSections((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      onSectionsChange?.(next);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ScriptTelemetry fullText={fullText} targetDurationSeconds={targetDurationSeconds} />

      <div className="space-y-3">
        {sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <RegenerateSection key={section.id} section={section} onRegenerated={handleSectionUpdate} />
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={extractClaims.isPending || !fullText.trim()}
          onClick={() => extractClaims.mutate({ scriptId, text: fullText })}
          className="rounded border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-teal)] disabled:opacity-50"
        >
          {extractClaims.isPending ? "Extracting claims…" : "Extract claims to ledger"}
        </button>
        {extractClaims.isSuccess && (
          <span className="text-xs text-[var(--color-teal)]">
            Logged {extractClaims.data.length} claim{extractClaims.data.length === 1 ? "" : "s"}
          </span>
        )}
        {extractClaims.isError && (
          <span className="text-xs text-[var(--color-coral)]">{extractClaims.error.message}</span>
        )}
      </div>

      <MetadataGenerator scriptId={scriptId} />
    </div>
  );
}
