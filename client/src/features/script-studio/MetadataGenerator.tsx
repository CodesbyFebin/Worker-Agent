import { trpc } from "../../lib/trpc";

interface MetadataGeneratorProps {
  scriptId: string;
}

export function MetadataGenerator({ scriptId }: MetadataGeneratorProps) {
  const generate = trpc.script.generateMetadata.useMutation();
  const result = generate.data;

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Metadata</h3>
        <button
          type="button"
          disabled={generate.isPending}
          onClick={() => generate.mutate({ scriptId, titleCount: 5 })}
          className="rounded bg-[var(--color-text-primary)] px-3 py-1 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
        >
          {generate.isPending ? "Generating…" : "Generate metadata"}
        </button>
      </div>

      {generate.isError && (
        <p className="mt-3 text-xs text-[var(--color-coral)]">Generation failed: {generate.error.message}</p>
      )}

      {result && (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <h4 className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Titles</h4>
            <ul className="space-y-1">
              {result.titles.map((title) => (
                <li key={title} className="rounded bg-[var(--color-surface-raised)] px-2 py-1 text-[var(--color-text-primary)]">
                  {title}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Description</h4>
            <p className="whitespace-pre-wrap text-[var(--color-text-primary)]">{result.description}</p>
          </div>

          <div>
            <h4 className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {result.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {result.thumbnailPrompt && (
            <div>
              <h4 className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Thumbnail prompt</h4>
              <p className="text-[var(--color-text-primary)]">{result.thumbnailPrompt}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
