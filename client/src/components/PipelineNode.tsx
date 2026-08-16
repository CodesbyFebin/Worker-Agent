import { type PipelineStageStatus, type PipelineStage } from "./PipelineStages";

interface PipelineNodeProps {
  stage: PipelineStage;
  status: PipelineStageStatus;
  isCurrent: boolean;
  detail?: string;
  onClick?: () => void;
}

const statusConfig = {
  completed: {
    dotClass: "bg-[var(--color-teal)] shadow-[0_0_8px_rgba(45,210,175,0.4)]",
    labelClass: "text-[var(--color-teal)]",
    borderClass: "border-[var(--color-teal)]/30",
  },
  active: {
    dotClass: "bg-[#7164ff] shadow-[0_0_16px_rgba(113,100,255,0.6)] animate-pulse",
    labelClass: "text-[#9a91ff]",
    borderClass: "border-[#7164ff]/40",
  },
  pending: {
    dotClass: "bg-[var(--color-line-strong)]",
    labelClass: "text-[var(--color-text-secondary)]",
    borderClass: "border-[var(--color-line)]",
  },
  blocked: {
    dotClass: "bg-amber-400/70 shadow-[0_0_8px_rgba(245,185,47,0.4)]",
    labelClass: "text-amber-400",
    borderClass: "border-amber-400/30",
  },
  error: {
    dotClass: "bg-red-400/80 shadow-[0_0_12px_rgba(248,113,113,0.5)]",
    labelClass: "text-red-400",
    borderClass: "border-red-400/30",
  },
};

const statusTooltip: Record<PipelineStageStatus, string> = {
  completed: "Completed",
  active: "In Progress",
  pending: "Pending",
  blocked: "Blocked",
  error: "Error",
};

export function PipelineNode({ stage, status, isCurrent, detail, onClick }: PipelineNodeProps) {
  const cfg = statusConfig[status];
  const Icon = stage.icon;
  const labelClass = isCurrent && status === "active" ? "text-white" : cfg.labelClass;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "pending" && !isCurrent}
      className="group relative flex flex-col items-center gap-2 outline-none"
    >
      <div
        className={`relative flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-[#0a0c11] transition-all duration-200 ${cfg.borderClass} ${status === "active" ? "scale-105" : "group-hover:scale-105"}`}
        title={statusTooltip[status]}
      >
        <div
          className={`absolute inset-0 rounded-xl ${status === "active" ? "opacity-20" : "opacity-0"} transition-opacity group-hover:opacity-30`}
        />
        <div className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
        <Icon className="relative z-10 h-5 w-5" style={{ color: getColorValue(status) }} />
      </div>

      <div className="flex flex-col items-center">
        <span className={`font-[var(--font-mono)] text-[8px] uppercase tracking-[0.12em] ${labelClass} transition-colors`}>
          {stage.label}
        </span>
        {detail && status !== "pending" && (
          <span className="mt-0.5 max-w-[90px] truncate text-center font-[var(--font-mono)] text-[7px] text-[var(--color-text-muted)]">
            {detail}
          </span>
        )}
      </div>
    </button>
  );
}

function getColorValue(status: PipelineStageStatus): string {
  switch (status) {
    case "completed":
      return "#2dd36f";
    case "active":
      return "#7164ff";
    case "blocked":
      return "#f5b54b";
    case "error":
      return "#f87171";
    default:
      return "#6b7280";
  }
}
