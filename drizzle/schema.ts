import {
  mysqlTable,
  varchar,
  int,
  text,
  timestamp,
  mysqlEnum,
  boolean,
  decimal,
  index,
} from "drizzle-orm/mysql-core";

/* -------------------------------------------------------------------------
 * EXISTING CORE TABLES (minimal stand-ins so this file is self-contained).
 * Replace these with your real `users` / `scripts` table definitions if
 * they already exist elsewhere in your schema — script_sections and
 * generated_metadata only need the `id` column to match.
 * ---------------------------------------------------------------------- */

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scripts = mysqlTable("scripts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  fullText: text("full_text").notNull(),
  targetDurationSeconds: int("target_duration_seconds").default(60),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/* -------------------------------------------------------------------------
 * PHASE 1: Script Studio — modular sections + cached generated metadata
 * ---------------------------------------------------------------------- */

export const scriptSections = mysqlTable(
  "script_sections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scriptId: varchar("script_id", { length: 36 })
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["hook", "body", "cta", "outro", "custom"]).notNull(),
    order: int("order").notNull(),
    content: text("content").notNull(),
    wordCount: int("word_count").notNull().default(0),
    lastRegeneratedAt: timestamp("last_regenerated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    scriptIdx: index("script_sections_script_id_idx").on(table.scriptId),
  }),
);

export const generatedMetadata = mysqlTable(
  "generated_metadata",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scriptId: varchar("script_id", { length: 36 })
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    titles: text("titles").notNull(), // JSON-encoded string[]
    description: text("description").notNull(),
    tags: text("tags").notNull(), // JSON-encoded string[]
    thumbnailPrompt: text("thumbnail_prompt"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    scriptIdx: index("generated_metadata_script_id_idx").on(table.scriptId),
  }),
);

/* -------------------------------------------------------------------------
 * PHASE 2 (scaffolded now): Claim Ledger — verified-fact provenance
 * ---------------------------------------------------------------------- */

export const claimLedger = mysqlTable(
  "claim_ledger",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scriptId: varchar("script_id", { length: 36 }).references(() => scripts.id, {
      onDelete: "cascade",
    }),
    devtag: varchar("devtag", { length: 64 }).notNull().unique(),
    claimText: text("claim_text").notNull(),
    sourceUrl: varchar("source_url", { length: 1024 }),
    confidenceScore: decimal("confidence_score", { precision: 4, scale: 3 }),
    verificationStatus: mysqlEnum("verification_status", [
      "pending",
      "verified",
      "rejected",
      "unverifiable",
    ])
      .notNull()
      .default("pending"),
    isImmutable: boolean("is_immutable").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    scriptIdx: index("claim_ledger_script_id_idx").on(table.scriptId),
    devtagIdx: index("claim_ledger_devtag_idx").on(table.devtag),
  }),
);

/* -------------------------------------------------------------------------
 * PHASE 3: Agentic Runtime — recursive task tree + isolated Git worktrees
 * ---------------------------------------------------------------------- */

export const agentRoleEnum = [
  "planner",
  "researcher",
  "writer",
  "reviewer",
  "coder",
  "qa",
  "publisher",
  "video_generator",
  "video_editor",
  "voiceover",
  "caption_hashtag",
  "seo",
] as const;

export const agentTaskStatusEnum = [
  "pending",
  "assigned",
  "running",
  "awaiting_approval",
  "blocked",
  "completed",
  "failed",
] as const;

export const agentTasks = mysqlTable(
  "agent_tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    parentTaskId: varchar("parent_task_id", { length: 36 }),
    scriptId: varchar("script_id", { length: 36 }).references(() => scripts.id, {
      onDelete: "cascade",
    }),
    campaignId: varchar("campaign_id", { length: 36 }),
    dayIndex: int("day_index"),
    agentRole: mysqlEnum("agent_role", agentRoleEnum).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Position among sibling subtasks — the orchestration engine runs these in order. */
    order: int("order").notNull().default(0),
    /** Free-form JSON-encoded input for the agent (goal text, prior output, etc). */
    payload: text("payload").notNull(),
    /** JSON-encoded result once completed. Null until the agent finishes. */
    result: text("result"),
    worktreeId: varchar("worktree_id", { length: 36 }),
    status: mysqlEnum("status", agentTaskStatusEnum).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    /** Aggregated across every LLM call this task made — see costTracking.ts. */
    inputTokens: int("input_tokens"),
    outputTokens: int("output_tokens"),
    costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
    /** When the publisher task should actually go live — used by the scheduler poller. */
    scheduledAt: timestamp("scheduled_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    parentIdx: index("agent_tasks_parent_task_id_idx").on(table.parentTaskId),
    scriptIdx: index("agent_tasks_script_id_idx").on(table.scriptId),
    statusIdx: index("agent_tasks_status_idx").on(table.status),
    campaignIdx: index("agent_tasks_campaign_id_idx").on(table.campaignId),
  }),
);

export const contentCampaigns = mysqlTable("content_campaigns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  topic: varchar("topic", { length: 500 }).notNull(),
  totalDays: int("total_days").notNull(),
  /** First scheduled publish date — day N publishes at startDate + N days, same time of day. */
  startDate: timestamp("start_date").notNull(),
  status: mysqlEnum("campaign_status", ["planning", "active", "paused", "completed"])
    .notNull()
    .default("planning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Content Ops handoff chain:
 * God Machine → Script Studio → Evidence → Research-to-Post → Workspace →
 * YouTube Autopilot → Social → Approvals → Publishing
 */
export const contentOpsPipelineStageEnum = [
  "god_machine",
  "script_studio",
  "evidence",
  "research_to_post",
  "workspace",
  "youtube_autopilot",
  "social",
  "approvals",
  "publishing",
  "done",
] as const;

export const contentOpsPipelines = mysqlTable(
  "content_ops_pipelines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    scriptId: varchar("script_id", { length: 36 })
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    rootTaskId: varchar("root_task_id", { length: 36 }),
    campaignId: varchar("campaign_id", { length: 36 }),
    title: varchar("title", { length: 255 }).notNull(),
    stage: mysqlEnum("pipeline_stage", contentOpsPipelineStageEnum).notNull().default("god_machine"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("content_ops_pipelines_user_id_idx").on(table.userId),
    scriptIdx: index("content_ops_pipelines_script_id_idx").on(table.scriptId),
    stageIdx: index("content_ops_pipelines_stage_idx").on(table.stage),
  }),
);

export const agentEvents = mysqlTable(
  "agent_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    taskId: varchar("task_id", { length: 36 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(), // e.g. "status_changed", "retry", "error"
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    taskIdx: index("agent_events_task_id_idx").on(table.taskId),
  }),
);

export const agentWorktrees = mysqlTable(
  "agent_worktrees",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    branchName: varchar("branch_name", { length: 255 }).notNull().unique(),
    /** Absolute filesystem path of the `git worktree add` checkout. */
    path: varchar("path", { length: 1024 }).notNull(),
    agentDepartment: mysqlEnum("agent_department", agentRoleEnum).notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
  },
  (table) => ({
    departmentIdx: index("agent_worktrees_department_idx").on(table.agentDepartment),
  }),
);
