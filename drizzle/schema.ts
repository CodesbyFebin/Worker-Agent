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
  displayName: varchar("display_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userCredentials = mysqlTable(
  "user_credentials",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    passwordUpdatedAt: timestamp("password_updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: index("user_credentials_user_id_idx").on(table.userId),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 2 — Authentication, organizations, RBAC, sessions, audit
 * ---------------------------------------------------------------------- */

export const organizations = mysqlTable(
  "organizations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("organizations_slug_idx").on(table.slug),
  }),
);

export const orgRoleSlugEnum = ["owner", "admin", "member", "viewer"] as const;

export const roles = mysqlTable(
  "roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    /** Null = system-wide role template usable by every org. */
    organizationId: varchar("organization_id", { length: 36 }),
    slug: mysqlEnum("role_slug", orgRoleSlugEnum).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("roles_organization_id_idx").on(table.organizationId),
    slugIdx: index("roles_slug_idx").on(table.slug),
  }),
);

export const permissions = mysqlTable("permissions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  description: varchar("description", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    roleId: varchar("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: varchar("permission_id", { length: 36 })
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: index("role_permissions_role_perm_idx").on(table.roleId, table.permissionId),
    roleIdx: index("role_permissions_role_id_idx").on(table.roleId),
  }),
);

export const organizationMembers = mysqlTable(
  "organization_members",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: varchar("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("organization_members_org_id_idx").on(table.organizationId),
    userIdx: index("organization_members_user_id_idx").on(table.userId),
    orgUserIdx: index("organization_members_org_user_idx").on(table.organizationId, table.userId),
  }),
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    /** SHA-256 hex of the opaque session token (token never stored plaintext). */
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    userAgent: varchar("user_agent", { length: 512 }),
  },
  (table) => ({
    tokenIdx: index("sessions_token_hash_idx").on(table.tokenHash),
    userIdx: index("sessions_user_id_idx").on(table.userId),
    orgIdx: index("sessions_organization_id_idx").on(table.organizationId),
    expiresIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    action: varchar("action", { length: 128 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }),
    resourceId: varchar("resource_id", { length: 64 }),
    payload: text("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("audit_logs_organization_id_idx").on(table.organizationId),
    actorIdx: index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    createdIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const scripts = mysqlTable(
  "scripts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    fullText: text("full_text").notNull(),
    targetDurationSeconds: int("target_duration_seconds").default(60),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("scripts_organization_id_idx").on(table.organizationId),
    userIdx: index("scripts_user_id_idx").on(table.userId),
  }),
);

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
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
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
    orgIdx: index("claim_ledger_organization_id_idx").on(table.organizationId),
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
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
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
    orgIdx: index("agent_tasks_organization_id_idx").on(table.organizationId),
    parentIdx: index("agent_tasks_parent_task_id_idx").on(table.parentTaskId),
    scriptIdx: index("agent_tasks_script_id_idx").on(table.scriptId),
    statusIdx: index("agent_tasks_status_idx").on(table.status),
    campaignIdx: index("agent_tasks_campaign_id_idx").on(table.campaignId),
  }),
);

export const contentCampaigns = mysqlTable(
  "content_campaigns",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
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
  },
  (table) => ({
    orgIdx: index("content_campaigns_organization_id_idx").on(table.organizationId),
    userIdx: index("content_campaigns_user_id_idx").on(table.userId),
  }),
);

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
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
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
    orgIdx: index("content_ops_pipelines_organization_id_idx").on(table.organizationId),
    userIdx: index("content_ops_pipelines_user_id_idx").on(table.userId),
    scriptIdx: index("content_ops_pipelines_script_id_idx").on(table.scriptId),
    stageIdx: index("content_ops_pipelines_stage_idx").on(table.stage),
  }),
);

export const agentEvents = mysqlTable(
  "agent_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
    taskId: varchar("task_id", { length: 36 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(), // e.g. "status_changed", "retry", "error"
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agent_events_organization_id_idx").on(table.organizationId),
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

/* -------------------------------------------------------------------------
 * Phase 3 — Durable workflow definitions, versions, runs, step runs
 * ---------------------------------------------------------------------- */

export const workflowStatusEnum = ["draft", "published", "archived"] as const;
export const workflowRunStatusEnum = [
  "created",
  "queued",
  "running",
  "paused",
  "awaiting_approval",
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
  "expired",
] as const;
export const workflowStepStatusEnum = [
  "pending",
  "queued",
  "assigned",
  "running",
  "waiting",
  "awaiting_input",
  "awaiting_approval",
  "retrying",
  "blocked",
  "cancel_requested",
  "cancelled",
  "completed",
  "failed",
  "expired",
  "skipped",
] as const;

export const workflowDefinitions = mysqlTable(
  "workflow_definitions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    currentVersionId: varchar("current_version_id", { length: 36 }),
    status: mysqlEnum("workflow_status", workflowStatusEnum).notNull().default("draft"),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("workflow_definitions_organization_id_idx").on(table.organizationId),
    statusIdx: index("workflow_definitions_status_idx").on(table.status),
  }),
);

export const workflowVersions = mysqlTable(
  "workflow_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workflowId: varchar("workflow_id", { length: 36 })
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    version: int("version").notNull(),
    /** JSON WorkflowGraph { nodes, edges } */
    graph: text("graph").notNull(),
    inputSchema: text("input_schema"),
    outputSchema: text("output_schema"),
    changeSummary: varchar("change_summary", { length: 512 }),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workflowIdx: index("workflow_versions_workflow_id_idx").on(table.workflowId),
    orgIdx: index("workflow_versions_organization_id_idx").on(table.organizationId),
    versionIdx: index("workflow_versions_workflow_version_idx").on(table.workflowId, table.version),
  }),
);

export const workflowRuns = mysqlTable(
  "workflow_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    workflowId: varchar("workflow_id", { length: 36 })
      .notNull()
      .references(() => workflowDefinitions.id),
    workflowVersionId: varchar("workflow_version_id", { length: 36 })
      .notNull()
      .references(() => workflowVersions.id),
    status: mysqlEnum("workflow_run_status", workflowRunStatusEnum).notNull().default("created"),
    triggerType: varchar("trigger_type", { length: 64 }).notNull().default("manual"),
    input: text("input"),
    output: text("output"),
    errorMessage: text("error_message"),
    startedBy: varchar("started_by", { length: 36 }).references(() => users.id),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("workflow_runs_organization_id_idx").on(table.organizationId),
    workflowIdx: index("workflow_runs_workflow_id_idx").on(table.workflowId),
    statusIdx: index("workflow_runs_status_idx").on(table.status),
    versionIdx: index("workflow_runs_version_id_idx").on(table.workflowVersionId),
  }),
);

export const workflowStepRuns = mysqlTable(
  "workflow_step_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    workflowRunId: varchar("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeId: varchar("node_id", { length: 128 }).notNull(),
    nodeType: varchar("node_type", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: mysqlEnum("workflow_step_status", workflowStepStatusEnum).notNull().default("pending"),
    attempt: int("attempt").notNull().default(0),
    input: text("input"),
    output: text("output"),
    errorMessage: text("error_message"),
    decisionSummary: text("decision_summary"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("workflow_step_runs_organization_id_idx").on(table.organizationId),
    runIdx: index("workflow_step_runs_run_id_idx").on(table.workflowRunId),
    statusIdx: index("workflow_step_runs_status_idx").on(table.status),
    nodeIdx: index("workflow_step_runs_run_node_idx").on(table.workflowRunId, table.nodeId),
    idemIdx: index("workflow_step_runs_idempotency_key_idx").on(table.idempotencyKey),
  }),
);

export const workflowRunEvents = mysqlTable(
  "workflow_run_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    workflowRunId: varchar("workflow_run_id", { length: 36 })
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    stepRunId: varchar("step_run_id", { length: 36 }),
    type: varchar("type", { length: 64 }).notNull(),
    message: text("message").notNull(),
    payload: text("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("workflow_run_events_organization_id_idx").on(table.organizationId),
    runIdx: index("workflow_run_events_run_id_idx").on(table.workflowRunId),
    createdIdx: index("workflow_run_events_created_at_idx").on(table.createdAt),
  }),
);

export const idempotencyRecords = mysqlTable(
  "idempotency_records",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }).notNull(),
    result: text("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgKeyIdx: index("idempotency_records_org_key_idx").on(table.organizationId, table.idempotencyKey),
    uniqueOrgKey: index("idempotency_records_key_unique_idx").on(table.idempotencyKey),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 5 — Agent definitions, policies, executions, evaluations
 * ---------------------------------------------------------------------- */

export const agentDefinitionStatusEnum = ["draft", "active", "disabled"] as const;

export const promptDefinitions = mysqlTable(
  "prompt_definitions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("prompt_definitions_organization_id_idx").on(table.organizationId),
  }),
);

export const promptVersions = mysqlTable(
  "prompt_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    promptId: varchar("prompt_id", { length: 36 })
      .notNull()
      .references(() => promptDefinitions.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    version: int("version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    changeSummary: varchar("change_summary", { length: 512 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    promptIdx: index("prompt_versions_prompt_id_idx").on(table.promptId),
    orgIdx: index("prompt_versions_organization_id_idx").on(table.organizationId),
  }),
);

export const modelPolicies = mysqlTable(
  "model_policies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    /** e.g. coding_high_quality | research | planning | fast_classification */
    policyKey: varchar("policy_key", { length: 64 }).notNull(),
    preferredProvider: varchar("preferred_provider", { length: 64 }),
    preferredModel: varchar("preferred_model", { length: 255 }),
    maxTokens: int("max_tokens").notNull().default(1024),
    temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.20"),
    fallbackProviders: text("fallback_providers"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("model_policies_organization_id_idx").on(table.organizationId),
    keyIdx: index("model_policies_policy_key_idx").on(table.policyKey),
  }),
);

export const toolPolicies = mysqlTable(
  "tool_policies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    /** JSON string[] of allowed tool names — empty = no tools. */
    allowedTools: text("allowed_tools").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("tool_policies_organization_id_idx").on(table.organizationId),
  }),
);

export const agentDefinitions = mysqlTable(
  "agent_definitions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    role: varchar("role", { length: 64 }).notNull(),
    currentVersionId: varchar("current_version_id", { length: 36 }),
    status: mysqlEnum("agent_definition_status", agentDefinitionStatusEnum).notNull().default("draft"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agent_definitions_organization_id_idx").on(table.organizationId),
    statusIdx: index("agent_definitions_status_idx").on(table.status),
    roleIdx: index("agent_definitions_role_idx").on(table.role),
  }),
);

export const agentVersions = mysqlTable(
  "agent_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    agentId: varchar("agent_id", { length: 36 })
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    version: int("version").notNull(),
    promptVersionId: varchar("prompt_version_id", { length: 36 })
      .notNull()
      .references(() => promptVersions.id),
    modelPolicyId: varchar("model_policy_id", { length: 36 })
      .notNull()
      .references(() => modelPolicies.id),
    toolPolicyId: varchar("tool_policy_id", { length: 36 })
      .notNull()
      .references(() => toolPolicies.id),
    /** JSON string[] of capability tags (e.g. research, draft, code_review). */
    capabilities: text("capabilities").notNull(),
    changeSummary: varchar("change_summary", { length: 512 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    agentIdx: index("agent_versions_agent_id_idx").on(table.agentId),
    orgIdx: index("agent_versions_organization_id_idx").on(table.organizationId),
    versionIdx: index("agent_versions_agent_version_idx").on(table.agentId, table.version),
  }),
);

export const agentExecutions = mysqlTable(
  "agent_executions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    agentId: varchar("agent_id", { length: 36 }).references(() => agentDefinitions.id),
    agentVersionId: varchar("agent_version_id", { length: 36 }).references(() => agentVersions.id),
    workflowRunId: varchar("workflow_run_id", { length: 36 }),
    workflowStepRunId: varchar("workflow_step_run_id", { length: 36 }),
    modelProvider: varchar("model_provider", { length: 64 }).notNull(),
    modelName: varchar("model_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    input: text("input").notNull(),
    output: text("output"),
    decisionSummary: text("decision_summary"),
    inputTokens: int("input_tokens"),
    outputTokens: int("output_tokens"),
    costUsd: decimal("cost_usd", { precision: 12, scale: 6 }),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agent_executions_organization_id_idx").on(table.organizationId),
    agentIdx: index("agent_executions_agent_id_idx").on(table.agentId),
    versionIdx: index("agent_executions_agent_version_id_idx").on(table.agentVersionId),
    statusIdx: index("agent_executions_status_idx").on(table.status),
    runIdx: index("agent_executions_workflow_run_id_idx").on(table.workflowRunId),
  }),
);

export const agentEvaluations = mysqlTable(
  "agent_evaluations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    agentId: varchar("agent_id", { length: 36 })
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** JSON: { input, expectContains?: string[], forbidContains?: string[], maxCostUsd?: number } */
    testCase: text("test_case").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agent_evaluations_organization_id_idx").on(table.organizationId),
    agentIdx: index("agent_evaluations_agent_id_idx").on(table.agentId),
  }),
);

export const agentEvaluationRuns = mysqlTable(
  "agent_evaluation_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    evaluationId: varchar("evaluation_id", { length: 36 })
      .notNull()
      .references(() => agentEvaluations.id, { onDelete: "cascade" }),
    agentVersionId: varchar("agent_version_id", { length: 36 }).references(() => agentVersions.id),
    agentExecutionId: varchar("agent_execution_id", { length: 36 }).references(() => agentExecutions.id),
    passed: boolean("passed").notNull(),
    score: decimal("score", { precision: 5, scale: 4 }),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agent_evaluation_runs_organization_id_idx").on(table.organizationId),
    evalIdx: index("agent_evaluation_runs_evaluation_id_idx").on(table.evaluationId),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 7 — Tool gateway, MCP registry, credential refs, invocations
 * ---------------------------------------------------------------------- */

export const toolSourceEnum = ["builtin", "mcp"] as const;
export const mcpTransportEnum = ["http", "stdio"] as const;
export const toolInvocationStatusEnum = ["queued", "running", "completed", "failed", "denied"] as const;

/** Org-scoped credential metadata — never stores secret values, only env key refs. */
export const credentialRefs = mysqlTable(
  "credential_refs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    /** Logical provider id e.g. openrouter, tavily, github */
    provider: varchar("provider", { length: 64 }).notNull(),
    /** Env var name that holds the secret — value never persisted here. */
    envKey: varchar("env_key", { length: 128 }).notNull(),
    description: text("description"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("credential_refs_organization_id_idx").on(table.organizationId),
    providerIdx: index("credential_refs_provider_idx").on(table.provider),
  }),
);

export const mcpServers = mysqlTable(
  "mcp_servers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    transport: mysqlEnum("mcp_transport", mcpTransportEnum).notNull(),
    /** HTTP endpoint or stdio command */
    endpoint: text("endpoint").notNull(),
    /** JSON: { args?: string[], envKeys?: string[], headers?: Record<string,string> } */
    config: text("config"),
    enabled: boolean("enabled").notNull().default(true),
    lastDiscoveredAt: timestamp("last_discovered_at"),
    lastError: text("last_error"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("mcp_servers_organization_id_idx").on(table.organizationId),
    enabledIdx: index("mcp_servers_enabled_idx").on(table.enabled),
  }),
);

export const toolDefinitions = mysqlTable(
  "tool_definitions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
    /** Unique within org (or global builtins with null org): e.g. search.web, mcp.serverId.tool */
    name: varchar("name", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    source: mysqlEnum("tool_source", toolSourceEnum).notNull(),
    mcpServerId: varchar("mcp_server_id", { length: 36 }).references(() => mcpServers.id, {
      onDelete: "cascade",
    }),
    /** JSON schema-ish input description */
    inputSchema: text("input_schema"),
    /** Required permission to invoke, e.g. tool:invoke */
    requiredPermission: varchar("required_permission", { length: 64 }).notNull().default("tool:invoke"),
    /** Optional credential provider this tool needs */
    credentialProvider: varchar("credential_provider", { length: 64 }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("tool_definitions_organization_id_idx").on(table.organizationId),
    nameIdx: index("tool_definitions_name_idx").on(table.name),
    sourceIdx: index("tool_definitions_source_idx").on(table.source),
    mcpIdx: index("tool_definitions_mcp_server_id_idx").on(table.mcpServerId),
  }),
);

/** Org policy: which tools / MCP servers are allowed. Empty allow = deny-all for MCP; builtins use defaultAllow. */
export const toolGatewayPolicies = mysqlTable(
  "tool_gateway_policies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    /** JSON string[] tool name allow-list; empty means use defaults */
    allowedTools: text("allowed_tools").notNull(),
    /** JSON string[] MCP server ids allowed */
    allowedMcpServerIds: text("allowed_mcp_server_ids").notNull(),
    /** JSON string[] tool names always denied */
    deniedTools: text("denied_tools").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("tool_gateway_policies_organization_id_idx").on(table.organizationId),
  }),
);

export const toolInvocations = mysqlTable(
  "tool_invocations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    toolName: varchar("tool_name", { length: 255 }).notNull(),
    toolDefinitionId: varchar("tool_definition_id", { length: 36 }).references(() => toolDefinitions.id),
    mcpServerId: varchar("mcp_server_id", { length: 36 }).references(() => mcpServers.id),
    actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id),
    agentExecutionId: varchar("agent_execution_id", { length: 36 }),
    status: mysqlEnum("tool_invocation_status", toolInvocationStatusEnum).notNull().default("queued"),
    input: text("input").notNull(),
    output: text("output"),
    error: text("error"),
    durationMs: int("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    orgIdx: index("tool_invocations_organization_id_idx").on(table.organizationId),
    toolIdx: index("tool_invocations_tool_name_idx").on(table.toolName),
    statusIdx: index("tool_invocations_status_idx").on(table.status),
    createdIdx: index("tool_invocations_created_at_idx").on(table.createdAt),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 8 — Approvals, governance policies, budgets, security events
 * ---------------------------------------------------------------------- */

export const approvalStatusEnum = ["pending", "approved", "rejected", "expired", "cancelled"] as const;
export const securitySeverityEnum = ["info", "low", "medium", "high", "critical"] as const;

export const governancePolicies = mysqlTable(
  "governance_policies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    /** JSON: trust/publish gate toggles */
    rules: text("rules").notNull(),
    /** Require human approval before publish / high-risk tool calls */
    requireHumanReview: boolean("require_human_review").notNull().default(true),
    /** Pause pipeline when claims unverified */
    pauseUnsupportedClaims: boolean("pause_unsupported_claims").notNull().default(true),
    updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("governance_policies_organization_id_idx").on(table.organizationId),
  }),
);

export const approvalRequests = mysqlTable(
  "approval_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    /** workflow_step | agent_task | tool_invoke | custom */
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    summary: text("summary"),
    /** Canonical JSON of the bound payload */
    payload: text("payload").notNull(),
    /** sha256 of canonical payload — decide rejects if payload drifts */
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: mysqlEnum("approval_status", approvalStatusEnum).notNull().default("pending"),
    requestedBy: varchar("requested_by", { length: 36 }).references(() => users.id),
    decidedBy: varchar("decided_by", { length: 36 }).references(() => users.id),
    decisionNote: text("decision_note"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
  },
  (table) => ({
    orgIdx: index("approval_requests_organization_id_idx").on(table.organizationId),
    statusIdx: index("approval_requests_status_idx").on(table.status),
    resourceIdx: index("approval_requests_resource_idx").on(table.resourceType, table.resourceId),
    createdIdx: index("approval_requests_created_at_idx").on(table.createdAt),
  }),
);

export const orgBudgets = mysqlTable(
  "org_budgets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    /** monthly | weekly | daily | lifetime */
    period: varchar("period", { length: 32 }).notNull().default("monthly"),
    limitUsd: decimal("limit_usd", { precision: 12, scale: 4 }).notNull(),
    /** soft = warn/security event; hard = deny spend/actions */
    enforcement: varchar("enforcement", { length: 16 }).notNull().default("hard"),
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
    updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("org_budgets_organization_id_idx").on(table.organizationId),
  }),
);

export const securityEvents = mysqlTable(
  "security_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
    severity: mysqlEnum("security_severity", securitySeverityEnum).notNull().default("info"),
    kind: varchar("kind", { length: 64 }).notNull(),
    message: text("message").notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id),
    resourceType: varchar("resource_type", { length: 64 }),
    resourceId: varchar("resource_id", { length: 64 }),
    payload: text("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("security_events_organization_id_idx").on(table.organizationId),
    severityIdx: index("security_events_severity_idx").on(table.severity),
    kindIdx: index("security_events_kind_idx").on(table.kind),
    createdIdx: index("security_events_created_at_idx").on(table.createdAt),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 9 — Artifacts (S3/local), versions, evidence snapshots & sources
 * ---------------------------------------------------------------------- */

export const artifactKindEnum = [
  "evidence",
  "document",
  "media",
  "snapshot",
  "other",
] as const;
export const storageBackendEnum = ["s3", "local"] as const;

export const artifacts = mysqlTable(
  "artifacts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    kind: mysqlEnum("artifact_kind", artifactKindEnum).notNull().default("other"),
    contentType: varchar("content_type", { length: 128 }).notNull().default("application/octet-stream"),
    currentVersionId: varchar("current_version_id", { length: 36 }),
    claimId: varchar("claim_id", { length: 36 }).references(() => claimLedger.id, {
      onDelete: "set null",
    }),
    campaignId: varchar("campaign_id", { length: 36 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("artifacts_organization_id_idx").on(table.organizationId),
    claimIdx: index("artifacts_claim_id_idx").on(table.claimId),
    kindIdx: index("artifacts_kind_idx").on(table.kind),
  }),
);

export const artifactVersions = mysqlTable(
  "artifact_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    artifactId: varchar("artifact_id", { length: 36 })
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    version: int("version").notNull(),
    storageBackend: mysqlEnum("storage_backend", storageBackendEnum).notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    sizeBytes: int("size_bytes").notNull().default(0),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    /** JSON metadata */
    metadata: text("metadata"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    artifactIdx: index("artifact_versions_artifact_id_idx").on(table.artifactId),
    orgIdx: index("artifact_versions_organization_id_idx").on(table.organizationId),
    versionIdx: index("artifact_versions_artifact_version_idx").on(table.artifactId, table.version),
  }),
);

export const evidenceSnapshots = mysqlTable(
  "evidence_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    claimId: varchar("claim_id", { length: 36 })
      .notNull()
      .references(() => claimLedger.id, { onDelete: "cascade" }),
    verificationStatus: varchar("verification_status", { length: 32 }).notNull(),
    confidenceScore: decimal("confidence_score", { precision: 4, scale: 3 }),
    notes: text("notes"),
    /** Optional artifact holding frozen snapshot JSON/blob */
    artifactId: varchar("artifact_id", { length: 36 }).references(() => artifacts.id, {
      onDelete: "set null",
    }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("evidence_snapshots_organization_id_idx").on(table.organizationId),
    claimIdx: index("evidence_snapshots_claim_id_idx").on(table.claimId),
    createdIdx: index("evidence_snapshots_created_at_idx").on(table.createdAt),
  }),
);

export const evidenceSources = mysqlTable(
  "evidence_sources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    snapshotId: varchar("snapshot_id", { length: 36 })
      .notNull()
      .references(() => evidenceSnapshots.id, { onDelete: "cascade" }),
    sourceUrl: varchar("source_url", { length: 1024 }).notNull(),
    supportingSentence: text("supporting_sentence"),
    relevanceScore: decimal("relevance_score", { precision: 4, scale: 3 }),
    /** 0-1 freshness: decays with age since last successful fetch */
    freshnessScore: decimal("freshness_score", { precision: 4, scale: 3 }),
    httpStatus: int("http_status"),
    contentHash: varchar("content_hash", { length: 64 }),
    fetchedAt: timestamp("fetched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("evidence_sources_organization_id_idx").on(table.organizationId),
    snapshotIdx: index("evidence_sources_snapshot_id_idx").on(table.snapshotId),
    urlIdx: index("evidence_sources_source_url_idx").on(table.sourceUrl),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 10 — Dead-letter jobs for exhausted BullMQ work
 * ---------------------------------------------------------------------- */

export const deadLetterStatusEnum = ["open", "retried", "discarded"] as const;

export const deadLetterJobs = mysqlTable(
  "dead_letter_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }),
    queueName: varchar("queue_name", { length: 128 }).notNull(),
    jobName: varchar("job_name", { length: 128 }),
    bullmqJobId: varchar("bullmq_job_id", { length: 64 }),
    /** Redacted JSON payload */
    payload: text("payload").notNull(),
    errorMessage: text("error_message").notNull(),
    attemptsMade: int("attempts_made").notNull().default(0),
    status: mysqlEnum("dead_letter_status", deadLetterStatusEnum).notNull().default("open"),
    resolvedBy: varchar("resolved_by", { length: 36 }).references(() => users.id),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("dead_letter_jobs_organization_id_idx").on(table.organizationId),
    statusIdx: index("dead_letter_jobs_status_idx").on(table.status),
    queueIdx: index("dead_letter_jobs_queue_name_idx").on(table.queueName),
    createdIdx: index("dead_letter_jobs_created_at_idx").on(table.createdAt),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 11 — YouTube Automation Studio (org = channel factory tenant)
 * ---------------------------------------------------------------------- */

export const youtubeVideoStatusEnum = [
  "draft",
  "scripted",
  "rendering",
  "compliance_hold",
  "scheduled",
  "uploading",
  "uploaded",
  "live",
  "failed",
] as const;

export const youtubeChannels = mysqlTable(
  "youtube_channels",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    channelName: varchar("channel_name", { length: 255 }).notNull(),
    /** YouTube channel id (UC…) when known */
    youtubeChannelId: varchar("youtube_channel_id", { length: 64 }),
    /**
     * Env var names holding OAuth secrets — never store raw tokens here
     * (matches credential_refs pattern). Per-channel keys enable 10 isolated
     * channels without fingerprinting one shared token.
     */
    accessTokenEnvKey: varchar("access_token_env_key", { length: 128 }).notNull(),
    refreshTokenEnvKey: varchar("refresh_token_env_key", { length: 128 }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    /** Distinct UA string for API calls (anti-fingerprint). */
    userAgent: varchar("user_agent", { length: 512 }),
    isActive: boolean("is_active").notNull().default(true),
    niche: varchar("niche", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("youtube_channels_organization_id_idx").on(table.organizationId),
    activeIdx: index("youtube_channels_is_active_idx").on(table.isActive),
    ytIdIdx: index("youtube_channels_youtube_channel_id_idx").on(table.youtubeChannelId),
  }),
);

export const youtubeVideos = mysqlTable(
  "youtube_videos",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    channelId: varchar("channel_id", { length: 36 })
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    workflowRunId: varchar("workflow_run_id", { length: 36 }).references(() => workflowRuns.id),
    youtubeVideoId: varchar("youtube_video_id", { length: 64 }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    topic: varchar("topic", { length: 512 }),
    localVideoPath: text("local_video_path"),
    thumbnailPath: text("thumbnail_path"),
    status: mysqlEnum("youtube_video_status", youtubeVideoStatusEnum).notNull().default("draft"),
    views: int("views").notNull().default(0),
    /** Average view duration ratio 0–1 when known from Analytics API */
    avgViewDuration: decimal("avg_view_duration", { precision: 5, scale: 4 }),
    scheduledAt: timestamp("scheduled_at"),
    uploadedAt: timestamp("uploaded_at"),
    complianceNotes: text("compliance_notes"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("youtube_videos_organization_id_idx").on(table.organizationId),
    channelIdx: index("youtube_videos_channel_id_idx").on(table.channelId),
    statusIdx: index("youtube_videos_status_idx").on(table.status),
    runIdx: index("youtube_videos_workflow_run_id_idx").on(table.workflowRunId),
  }),
);

export const youtubeTrends = mysqlTable(
  "youtube_trends",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    query: varchar("query", { length: 512 }).notNull(),
    /** Redacted JSON array of search hits */
    resultsJson: text("results_json").notNull(),
    source: varchar("source", { length: 64 }).notNull().default("youtube_data_api"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("youtube_trends_organization_id_idx").on(table.organizationId),
    queryIdx: index("youtube_trends_query_idx").on(table.query),
    fetchedIdx: index("youtube_trends_fetched_at_idx").on(table.fetchedAt),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 16.5+ — Knowledge Layer (vector, taxonomy, brand, winning patterns)
 * ---------------------------------------------------------------------- */

export const embeddingBackendEnum = ["local_sentence_transformers", "pinecone", "milvus", "openai"] as const;

export const knowledgeEmbeddings = mysqlTable(
  "knowledge_embeddings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    /** artifact | script | trend | prompt | brand_guideline | winning_pattern */
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }).notNull(),
    /** JSON text stored for fast filtering without hitting source table */
    metadata: text("metadata"),
    /** JSON array of floats — replace with native vector when supported */
    embeddingJson: text("embedding_json").notNull(),
    model: varchar("model", { length: 128 }).notNull().default("all-MiniLM-L6-v2"),
    backend: mysqlEnum("embedding_backend", embeddingBackendEnum).notNull().default("local_sentence_transformers"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("knowledge_embeddings_organization_id_idx").on(table.organizationId),
    entityIdx: index("knowledge_embeddings_entity_idx").on(table.entityType, table.entityId),
    backendIdx: index("knowledge_embeddings_backend_idx").on(table.backend),
  }),
);

export const topicTaxonomies = mysqlTable(
  "topic_taxonomies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    parentId: varchar("parent_id", { length: 36 }),
    properties: text("properties"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("topic_taxonomies_organization_id_idx").on(table.organizationId),
    slugIdx: index("topic_taxonomies_slug_idx").on(table.slug),
    parentIdx: index("topic_taxonomies_parent_id_idx").on(table.parentId),
  }),
);

export const brandGuidelines = mysqlTable(
  "brand_guidelines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    voice: text("voice"),
    style: text("style"),
    terminology: text("terminology"),
    approvedClaims: text("approved_claims"),
    disallowedClaims: text("disallowed_claims"),
    logoUsage: text("logo_usage"),
    colorPalette: text("color_palette"),
    typography: text("typography"),
    messaging: text("messaging"),
    complianceRules: text("compliance_rules"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("brand_guidelines_organization_id_idx").on(table.organizationId),
  }),
);

export const winningPatterns = mysqlTable(
  "winning_patterns",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    sourceVideoId: varchar("source_video_id", { length: 36 }).references(() => youtubeVideos.id, {
      onDelete: "set null",
    }),
    sourceScriptId: varchar("source_script_id", { length: 36 }).references(() => scripts.id, {
      onDelete: "set null",
    }),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    topicTags: text("topic_tags"),
    /** Redacted JSON with winning attributes */
    patternJson: text("pattern_json").notNull(),
    performance: text("performance"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("winning_patterns_organization_id_idx").on(table.organizationId),
    contentTypeIdx: index("winning_patterns_content_type_idx").on(table.contentType),
    videoIdx: index("winning_patterns_source_video_id_idx").on(table.sourceVideoId),
    scriptIdx: index("winning_patterns_source_script_id_idx").on(table.sourceScriptId),
  }),
);

export const researchArchive = mysqlTable(
  "research_archive",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id),
    topic: varchar("topic", { length: 512 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    /** Redacted JSON payload */
    payload: text("payload").notNull(),
    confidenceScore: decimal("confidence_score", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("research_archive_organization_id_idx").on(table.organizationId),
    topicIdx: index("research_archive_topic_idx").on(table.topic),
    sourceIdx: index("research_archive_source_idx").on(table.source),
  }),
);

/* -------------------------------------------------------------------------
 * Security Hardening — API keys, MFA, encrypted vault
 * ---------------------------------------------------------------------- */

export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    prefix: varchar("prefix", { length: 64 }).notNull().unique(),
    hash: varchar("hash", { length: 64 }).notNull(),
    scopes: text("scopes").notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    lastRotatedAt: timestamp("last_rotated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("api_keys_user_id_idx").on(table.userId),
    orgIdx: index("api_keys_organization_id_idx").on(table.organizationId),
    prefixIdx: index("api_keys_prefix_idx").on(table.prefix),
    expiresIdx: index("api_keys_expires_at_idx").on(table.expiresAt),
  }),
);

export const mfaFactors = mysqlTable(
  "mfa_factors",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("mfa_type", ["totp", "webauthn", "sms"]).notNull(),
    secret: varchar("secret", { length: 255 }).notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("mfa_factors_user_id_idx").on(table.userId),
    typeIdx: index("mfa_factors_type_idx").on(table.type),
  }),
);

export const mfaBackupCodes = mysqlTable(
  "mfa_backup_codes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    factorId: varchar("factor_id", { length: 36 })
      .notNull()
      .references(() => mfaFactors.id, { onDelete: "cascade" }),
    hash: varchar("hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    factorIdx: index("mfa_backup_codes_factor_id_idx").on(table.factorId),
    usedIdx: index("mfa_backup_codes_used_at_idx").on(table.usedAt),
  }),
);

export const vaultSecrets = mysqlTable(
  "vault_secrets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    provider: mysqlEnum("vault_provider", ["hashicorp", "doppler", "env"]).notNull(),
    path: varchar("path", { length: 512 }).notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    version: int("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("vault_secrets_organization_id_idx").on(table.organizationId),
    providerIdx: index("vault_secrets_provider_idx").on(table.provider),
    pathIdx: index("vault_secrets_path_idx").on(table.path),
    expiresIdx: index("vault_secrets_expires_at_idx").on(table.expiresAt),
  }),
);

export const webhooks = mysqlTable(
  "webhooks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    targetUrl: text("target_url").notNull(),
    secretHash: varchar("secret_hash", { length: 64 }).notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("webhooks_organization_id_idx").on(table.organizationId),
    eventIdx: index("webhooks_event_type_idx").on(table.eventType),
    createdIdx: index("webhooks_created_at_idx").on(table.createdAt),
  }),
);

/* -------------------------------------------------------------------------
 * Phase 15 — White-Hat Compliance Engine
 * ---------------------------------------------------------------------- */

export const complianceVerdicts = mysqlTable(
  "compliance_verdicts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceType: mysqlEnum("resource_type",
      ["script", "video", "comment", "campaign", "metadata"]).notNull(),
    resourceId: varchar("resource_id", { length: 36 }).notNull(),
    checkKey: varchar("check_key", { length: 64 }).notNull(),
    verdict: mysqlEnum("verdict", ["pass", "review", "block"]).notNull(),
    evidenceJson: text("evidence_json").notNull(),
    policyVersion: int("policy_version").notNull().default(1),
    checkedBy: mysqlEnum("checked_by", ["engine", "human"]).notNull().default("engine"),
    decidedBy: varchar("decided_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    orgIdx: index("compliance_verdicts_organization_id_idx").on(table.organizationId),
    resIdx: index("compliance_verdicts_resource_idx").on(table.resourceType, table.resourceId),
    keyIdx: index("compliance_verdicts_check_key_idx").on(table.checkKey),
  }),
);

export const quotaLedger = mysqlTable(
  "quota_ledger",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    channelRef: varchar("channel_ref", { length: 64 }),
    operation: varchar("operation", { length: 128 }).notNull(),
    quotaUnits: int("quota_units").notNull(),
    requestId: varchar("request_id", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("quota_ledger_organization_id_idx").on(table.organizationId),
    provIdx: index("quota_ledger_provider_created_idx").on(table.provider, table.createdAt),
  }),
);

