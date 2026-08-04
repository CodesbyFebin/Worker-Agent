import { useState } from "react";

const DEFAULT_PREVIEW = "http://localhost:5173";

/**
 * Embeds a live browser preview. Defaults to the Vite app URL — not a fake
 * screenshot. Cross-origin pages may block iframe embedding.
 */
export function IdeBrowserPreview() {
  const [url, setUrl] = useState(
    (import.meta.env.VITE_PREVIEW_URL as string | undefined) || DEFAULT_PREVIEW,
  );
  const [loaded, setLoaded] = useState(url);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setLoaded(url)}
          className="min-w-0 flex-1 rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 font-[var(--font-mono)] text-[11px]"
          placeholder="http://localhost:5173"
        />
        <button
          type="button"
          onClick={() => setLoaded(url)}
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[10px]"
        >
          Load
        </button>
        <a
          href={loaded}
          target="_blank"
          rel="noreferrer"
          className="rounded bg-[var(--color-teal)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink)]"
        >
          Open
        </a>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        Live iframe — if blank, the target sent `X-Frame-Options` / CSP. Use Open for a full tab.
      </p>
      <iframe
        title="IDEa browser preview"
        src={loaded}
        className="min-h-0 flex-1 rounded border border-[var(--color-line)] bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
