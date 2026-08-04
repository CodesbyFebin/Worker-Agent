import { useState, type ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { WorkerAgentLogo } from "./WorkerAgentLogo";
import { ModelChooser } from "./ModelChooser";

/**
 * Shared ContentOps top chrome — agent/team selectors + model chooser + search.
 */
export function TopChrome({
  title = "ContentOps Agent",
  status,
  statusTone = "amber",
  actions,
  showSearch = true,
}: {
  title?: string;
  status?: string;
  statusTone?: "amber" | "teal" | "violet";
  actions?: ReactNode;
  showSearch?: boolean;
}) {
  const [team, setTeam] = useState("Editorial Team");
  const [collection, setCollection] = useState("Weekly Content Engine");
  const tone =
    statusTone === "teal"
      ? "text-[var(--color-teal)]"
      : statusTone === "violet"
        ? "text-[var(--color-violet)]"
        : "text-[var(--color-amber)]";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 px-3 py-2 backdrop-blur-md">
      <div className="mr-1 hidden sm:block lg:hidden">
        <WorkerAgentLogo size={24} showWordmark={false} />
      </div>
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</p>
      <span className="text-[var(--color-text-muted)]">|</span>
      <select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="max-w-[140px] truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[12px]"
      >
        <option>Editorial Team</option>
        <option>Social Video Team</option>
        <option>Brand Team</option>
        <option>Growth Team</option>
      </select>
      <select
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        className="max-w-[180px] truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1 text-[12px]"
      >
        <option>Weekly Content Engine</option>
        <option>Weekly Short-Form Series</option>
        <option>Authority Blog</option>
        <option>Always-On Social</option>
        <option>Research-to-Post</option>
      </select>
      {status && (
        <span className={`flex items-center gap-1.5 text-[12px] ${tone}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status}
        </span>
      )}
      {showSearch && (
        <div className="relative mx-auto hidden min-w-[160px] max-w-md flex-1 md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            placeholder="Search workspace… ⌘K"
            className="w-full rounded-full border border-[var(--color-line)] bg-[var(--color-ink)] py-1.5 pl-8 pr-3 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ModelChooser compact />
        {actions}
        <button
          type="button"
          className="relative rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
        >
          <Bell size={16} />
        </button>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-violet)]/30 text-[10px] font-bold text-[var(--color-text-primary)] ring-1 ring-[var(--color-violet)]/50">
          WA
        </div>
      </div>
    </header>
  );
}
