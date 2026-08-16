ALTER TABLE agent_tasks
  MODIFY COLUMN status ENUM(
    'pending',
    'assigned',
    'running',
    'awaiting_approval',
    'blocked',
    'completed',
    'failed',
    'ready',
    'claimed',
    'waiting',
    'retrying',
    'cancelled',
    'timed_out'
  ) NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS mission_control_approvals (
  id VARCHAR(64) PRIMARY KEY,
  approval_gate_key VARCHAR(64) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  type ENUM('unsupported_claim','publication','high_cost','external_action','security_sensitive') NOT NULL,
  status ENUM('pending','approved','rejected','expired','superseded') NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by VARCHAR(36) NOT NULL,
  resolved_at TIMESTAMP NULL,
  resolved_by VARCHAR(36) NULL,
  decision_note TEXT NULL,
  policy_version VARCHAR(32) NOT NULL,
  policy_rule_id VARCHAR(64) NOT NULL,
  evaluation_revision VARCHAR(64) NOT NULL,
  subject_digest VARCHAR(64) NOT NULL,
  reasons TEXT NOT NULL,
  UNIQUE KEY uq_mission_control_approval_gate (approval_gate_key),
  KEY mission_control_approvals_org_idx (organization_id),
  KEY mission_control_approvals_task_idx (task_id),
  KEY mission_control_approvals_status_idx (status),
  CONSTRAINT mission_control_approvals_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT mission_control_approvals_task_fk
    FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mission_control_event_log (
  stream_position BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  aggregate_type VARCHAR(32) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  aggregate_version INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mission_control_event_id (event_id),
  KEY mission_control_event_org_stream_idx (organization_id, stream_position),
  KEY mission_control_event_aggregate_idx (aggregate_type, aggregate_id, aggregate_version),
  CONSTRAINT mission_control_event_log_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mission_control_event_outbox (
  event_id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  aggregate_type VARCHAR(32) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  aggregate_version INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','processing','processed') NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP NULL,
  claimed_by VARCHAR(64) NULL,
  last_error TEXT NULL,
  processed_at TIMESTAMP NULL,
  KEY mission_control_outbox_claim_idx (status, created_at),
  KEY mission_control_outbox_org_idx (organization_id),
  CONSTRAINT mission_control_event_outbox_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
