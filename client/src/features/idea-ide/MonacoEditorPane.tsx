import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

function languageForPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    sql: "sql",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    ps1: "powershell",
    py: "python",
  };
  return map[ext] ?? "plaintext";
}

type Props = {
  path: string;
  content: string;
  truncated?: boolean;
  onSave: (content: string) => Promise<void> | void;
  saving?: boolean;
};

export function MonacoEditorPane({ path, content, truncated, onSave, saving }: Props) {
  const [value, setValue] = useState(content);
  const [dirty, setDirty] = useState(false);
  const language = useMemo(() => languageForPath(path), [path]);

  useEffect(() => {
    setValue(content);
    setDirty(false);
  }, [path, content]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) void onSave(value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, value, onSave]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1">
        <span className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          {path}
          {dirty ? " · modified" : ""}
          {truncated ? " · truncated preview" : ""}
        </span>
        <button
          type="button"
          disabled={!dirty || saving || truncated}
          onClick={() => void onSave(value)}
          className="ml-auto rounded bg-[var(--color-teal)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink)] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          value={value}
          path={path}
          options={{
            readOnly: Boolean(truncated),
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
          }}
          onChange={(v) => {
            setValue(v ?? "");
            setDirty((v ?? "") !== content);
          }}
        />
      </div>
    </div>
  );
}
