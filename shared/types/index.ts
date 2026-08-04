export type SectionKind = "hook" | "body" | "cta" | "outro" | "custom";

export interface ScriptSectionDTO {
  id: string;
  scriptId: string;
  kind: SectionKind;
  order: number;
  content: string;
  wordCount: number;
  lastRegeneratedAt: string | null;
}

export interface GeneratedMetadataDTO {
  id: string;
  scriptId: string;
  titles: string[];
  description: string;
  tags: string[];
  thumbnailPrompt: string | null;
  createdAt: string;
}

export type ClaimVerificationStatus = "pending" | "verified" | "rejected" | "unverifiable";

export interface ClaimLedgerEntryDTO {
  id: string;
  scriptId: string | null;
  devtag: string;
  claimText: string;
  sourceUrl: string | null;
  confidenceScore: number | null;
  verificationStatus: ClaimVerificationStatus;
  createdAt: string;
}

/** WPM used to estimate spoken read time in ScriptTelemetry.tsx */
export const AVERAGE_SPOKEN_WORDS_PER_MINUTE = 150;

export type AgentRole =
  | "planner"
  | "researcher"
  | "writer"
  | "reviewer"
  | "coder"
  | "qa"
  | "publisher"
  | "video_generator"
  | "video_editor"
  | "voiceover"
  | "caption_hashtag"
  | "seo";

export type AgentTaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "awaiting_approval"
  | "blocked"
  | "completed"
  | "failed";

export interface AgentTaskDTO {
  id: string;
  parentTaskId: string | null;
  scriptId: string | null;
  agentRole: AgentRole;
  title: string;
  payload: unknown;
  result: unknown;
  worktreeId: string | null;
  status: AgentTaskStatus;
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  createdAt: string;
  updatedAt: string;
}
