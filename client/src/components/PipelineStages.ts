import type { ComponentType, SVGProps } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardEdit,
  FileText,
  Folder,
  Globe2,
  Send,
  Share2,
  ShieldCheck,
  Upload,
} from "lucide-react";

export type PipelineStageKey =
  | "god_machine"
  | "script_studio"
  | "evidence"
  | "research_to_post"
  | "workspace"
  | "youtube_autopilot"
  | "social"
  | "approvals"
  | "publishing"
  | "done";

export type PipelineStageStatus = "completed" | "active" | "pending" | "blocked" | "error";

export interface PipelineStage {
  key: PipelineStageKey;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  shortLabel: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "god_machine", label: "God Machine", icon: BrainCircuit, shortLabel: "GM" },
  { key: "script_studio", label: "Script Studio", icon: ClipboardEdit, shortLabel: "Script" },
  { key: "evidence", label: "Evidence", icon: FileText, shortLabel: "Evidence" },
  { key: "research_to_post", label: "Research-to-Post", icon: Globe2, shortLabel: "R2P" },
  { key: "workspace", label: "Workspace", icon: Folder, shortLabel: "Work" },
  { key: "youtube_autopilot", label: "YouTube Autopilot", icon: Upload, shortLabel: "YT" },
  { key: "social", label: "Social Manager", icon: Share2, shortLabel: "Social" },
  { key: "approvals", label: "Approvals", icon: ShieldCheck, shortLabel: "Approve" },
  { key: "publishing", label: "Publishing", icon: Send, shortLabel: "Publish" },
  { key: "done", label: "Done", icon: CheckCircle2, shortLabel: "Done" },
];

export const STAGE_WORKSPACE: Record<Exclude<PipelineStageKey, "done">, string> = {
  god_machine: "god-machine",
  script_studio: "script-studio",
  evidence: "evidence",
  research_to_post: "research-to-post",
  workspace: "workspace",
  youtube_autopilot: "youtube-automode",
  social: "social-manager",
  approvals: "approvals",
  publishing: "publishing",
};

export function getStageStatus(
  currentStage: PipelineStageKey | null,
  completedStages: PipelineStageKey[],
  errorStages: PipelineStageKey[],
  stage: PipelineStageKey,
): PipelineStageStatus {
  if (errorStages.includes(stage)) return "error";
  if (stage === "done") return completedStages.length === PIPELINE_STAGES.length - 1 ? "completed" : "pending";
  if (completedStages.includes(stage)) return "completed";
  if (currentStage === stage) return "active";
  return "pending";
}
