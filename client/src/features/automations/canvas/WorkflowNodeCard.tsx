import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { statusColor, type StepStatus, type WorkflowNodeType } from "../workflowGraph";

export type WorkflowRfData = {
  label: string;
  nodeType: WorkflowNodeType;
  status?: StepStatus | string;
  requiresApproval?: boolean;
  selected?: boolean;
};

function WorkflowNodeCardInner({ data, selected }: NodeProps) {
  const d = data as WorkflowRfData;
  const accent = statusColor(d.status);
  return (
    <div
      className={`min-w-[180px] max-w-[220px] rounded-xl border bg-[var(--color-surface)] px-3 py-2 shadow-lg ${
        selected ? "border-[var(--color-violet)] shadow-[var(--glow-magenta)]" : "border-[var(--color-line)]"
      }`}
      style={{ boxShadow: d.status ? `0 0 0 1px ${accent}` : undefined }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-[var(--color-ink)] !bg-[var(--color-teal)]"
      />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
        <p className="truncate text-[12px] font-semibold text-[var(--color-text-primary)]">{d.label}</p>
      </div>
      <p className="mt-0.5 truncate font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
        {d.nodeType}
      </p>
      {d.status && (
        <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: accent }}>
          {d.status}
        </p>
      )}
      {d.requiresApproval && !d.status && (
        <p className="mt-1 text-[10px] text-[var(--color-violet)]">Needs approval</p>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-[var(--color-ink)] !bg-[var(--color-amber)]"
      />
    </div>
  );
}

export const WorkflowNodeCard = memo(WorkflowNodeCardInner);
