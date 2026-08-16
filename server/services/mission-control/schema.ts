import {
  bigint,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Mission-Control-local mirrors of existing tables extended by 0042.
 * These keep the new durable-control services isolated from unrelated schema
 * churn while preserving exact physical table/column names.
 */
export const mcAgentTasks = mysqlTable("agent_tasks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 36 }),
  runId: varchar("run_id", { length: 36 }),
  agentRole: varchar("agent_role", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const mcWorkflowRuns = mysqlTable("workflow_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 36 }).notNull(),
  traceId: varchar("trace_id", { length: 64 }),
});

export const missionControlApprovals = mysqlTable(
  "mission_control_approvals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    approvalGateKey: varchar("approval_gate_key", { length: 64 }).notNull(),
    organizationId: varchar("organization_id", { length: 36 }).notNull(),
    taskId: varchar("task_id", { length: 36 }).notNull(),
    runId: varchar("run_id", { length: 36 }),
    type: mysqlEnum("type", [
      "unsupported_claim",
      "publication",
      "high_cost",
      "external_action",
      "security_sensitive",
    ]).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
      "expired",
      "superseded",
    ])
      .notNull()
      .default("pending"),
    reason: text("reason"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    requestedBy: varchar("requested_by", { length: 36 }).notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: varchar("resolved_by", { length: 36 }),
    decisionNote: text("decision_note"),
    policyVersion: varchar("policy_version", { length: 32 }).notNull(),
    policyRuleId: varchar("policy_rule_id", { length: 64 }).notNull(),
    evaluationRevision: varchar("evaluation_revision", { length: 64 }).notNull(),
    subjectDigest: varchar("subject_digest", { length: 64 }).notNull(),
    reasons: text("reasons").notNull(),
  },
  (table) => ({
    gateKey: uniqueIndex("uq_mission_control_approval_gate").on(table.approvalGateKey),
    orgIdx: index("mission_control_approvals_org_idx").on(table.organizationId),
    taskIdx: index("mission_control_approvals_task_idx").on(table.taskId),
    statusIdx: index("mission_control_approvals_status_idx").on(table.status),
    runIdx: index("mc_approvals_run_idx").on(table.runId),
  }),
);

export const missionControlEventLog = mysqlTable(
  "mission_control_event_log",
  {
    streamPosition: bigint("stream_position", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    eventId: varchar("event_id", { length: 64 }).notNull(),
    organizationId: varchar("organization_id", { length: 36 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 32 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 64 }).notNull(),
    aggregateVersion: int("aggregate_version").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    traceId: varchar("trace_id", { length: 64 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    eventIdUq: uniqueIndex("uq_mission_control_event_id").on(table.eventId),
    orgStream: index("mission_control_event_org_stream_idx").on(
      table.organizationId,
      table.streamPosition,
    ),
    aggregateIdx: index("mission_control_event_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
    ),
  }),
);

export const missionControlEventOutbox = mysqlTable(
  "mission_control_event_outbox",
  {
    eventId: varchar("event_id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 32 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 64 }).notNull(),
    aggregateVersion: int("aggregate_version").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    traceId: varchar("trace_id", { length: 64 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    status: mysqlEnum("status", ["pending", "processing", "processed"])
      .notNull()
      .default("pending"),
    attemptCount: int("attempt_count").notNull().default(0),
    claimedAt: timestamp("claimed_at"),
    claimedBy: varchar("claimed_by", { length: 64 }),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    claimIdx: index("mission_control_outbox_claim_idx").on(table.status, table.createdAt),
    orgIdx: index("mission_control_outbox_org_idx").on(table.organizationId),
  }),
);
