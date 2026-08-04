import { useMemo } from "react";
import { AVERAGE_SPOKEN_WORDS_PER_MINUTE } from "../../../../shared/types";

interface ScriptTelemetryProps {
  fullText: string;
  targetDurationSeconds?: number;
}

function countWords(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export function ScriptTelemetry({ fullText, targetDurationSeconds }: ScriptTelemetryProps) {
  const wordCount = useMemo(() => countWords(fullText), [fullText]);
  const estimatedSeconds = useMemo(
    () => Math.round((wordCount / AVERAGE_SPOKEN_WORDS_PER_MINUTE) * 60),
    [wordCount],
  );

  const overTarget = targetDurationSeconds != null && estimatedSeconds > targetDurationSeconds;

  return (
    <div className="flex items-center gap-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
      <div>
        <span className="font-mono text-[var(--color-text-primary)]">{wordCount}</span>{" "}
        <span className="text-[var(--color-text-muted)]">words</span>
      </div>
      <div>
        <span className={`font-mono ${overTarget ? "text-[var(--color-amber)]" : "text-[var(--color-text-primary)]"}`}>
          ~{estimatedSeconds}s
        </span>{" "}
        <span className="text-[var(--color-text-muted)]">read time</span>
      </div>
      {targetDurationSeconds != null && (
        <div className="text-[var(--color-text-muted)]">
          target <span className="font-mono text-[var(--color-text-muted)]">{targetDurationSeconds}s</span>
          {overTarget && <span className="ml-2 text-[var(--color-amber)]">over by {estimatedSeconds - targetDurationSeconds}s</span>}
        </div>
      )}
    </div>
  );
}
