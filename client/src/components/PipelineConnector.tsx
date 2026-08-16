import { type PipelineStageStatus } from "./PipelineStages";

interface PipelineConnectorProps {
  fromStatus: PipelineStageStatus;
  toStatus: PipelineStageStatus;
  isAnimating: boolean;
}

const statusColor: Record<PipelineStageStatus, string> = {
  completed: "#2dd36f",
  active: "#7164ff",
  pending: "#374151",
  blocked: "#f5b54b",
  error: "#f87171",
};

export function PipelineConnector({ fromStatus, toStatus, isAnimating }: PipelineConnectorProps) {
  const color = fromStatus === "completed" && toStatus !== "pending" ? statusColor[toStatus] : statusColor[fromStatus];
  const isComplete = fromStatus === "completed";
  const hasActivity = isAnimating && (fromStatus === "active" || toStatus === "active");

  return (
    <div
      className="relative h-1.5 w-full flex-1 transition-all"
      style={{
        backgroundColor: color,
        opacity: isComplete ? 0.8 : hasActivity ? 0.6 : 0.25,
        boxShadow: hasActivity ? `0 0 8px ${color}` : "none",
        transition: "all 0.3s ease-in-out",
      }}
    >
      {hasActivity && (
        <div
          className="absolute inset-0 rounded-sm opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            animation: "pulse 1s ease-in-out infinite",
          }}
        />
      )}
      {isComplete && (
        <div className="absolute -right-1 -top-2 h-2 w-2 rotate-45 rounded-sm" style={{ backgroundColor: color, opacity: 0.4 }} />
      )}
    </div>
  );
}
