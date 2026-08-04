-- Phase 3 durable workflow engine tables

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  current_version_id VARCHAR(36) NULL,
  workflow_status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT workflow_definitions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT workflow_definitions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS workflow_definitions_organization_id_idx ON workflow_definitions (organization_id);
CREATE INDEX IF NOT EXISTS workflow_definitions_status_idx ON workflow_definitions (workflow_status);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id VARCHAR(36) PRIMARY KEY,
  workflow_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  graph TEXT NOT NULL,
  input_schema TEXT NULL,
  output_schema TEXT NULL,
  change_summary VARCHAR(512) NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT workflow_versions_workflow_fk FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  CONSTRAINT workflow_versions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT workflow_versions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx ON workflow_versions (workflow_id);
CREATE INDEX IF NOT EXISTS workflow_versions_organization_id_idx ON workflow_versions (organization_id);
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_version_idx ON workflow_versions (workflow_id, version);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  workflow_id VARCHAR(36) NOT NULL,
  workflow_version_id VARCHAR(36) NOT NULL,
  workflow_run_status ENUM('created','queued','running','paused','awaiting_approval','completed','completed_with_warnings','failed','cancelled','expired') NOT NULL DEFAULT 'created',
  trigger_type VARCHAR(64) NOT NULL DEFAULT 'manual',
  input TEXT NULL,
  output TEXT NULL,
  error_message TEXT NULL,
  started_by VARCHAR(36) NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT workflow_runs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT workflow_runs_workflow_fk FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id),
  CONSTRAINT workflow_runs_version_fk FOREIGN KEY (workflow_version_id) REFERENCES workflow_versions(id),
  CONSTRAINT workflow_runs_user_fk FOREIGN KEY (started_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS workflow_runs_organization_id_idx ON workflow_runs (organization_id);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_id_idx ON workflow_runs (workflow_id);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (workflow_run_status);
CREATE INDEX IF NOT EXISTS workflow_runs_version_id_idx ON workflow_runs (workflow_version_id);

CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  workflow_run_id VARCHAR(36) NOT NULL,
  node_id VARCHAR(128) NOT NULL,
  node_type VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  workflow_step_status ENUM('pending','queued','assigned','running','waiting','awaiting_input','awaiting_approval','retrying','blocked','cancel_requested','cancelled','completed','failed','expired','skipped') NOT NULL DEFAULT 'pending',
  attempt INT NOT NULL DEFAULT 0,
  input TEXT NULL,
  output TEXT NULL,
  error_message TEXT NULL,
  decision_summary TEXT NULL,
  idempotency_key VARCHAR(255) NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT workflow_step_runs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT workflow_step_runs_run_fk FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS workflow_step_runs_organization_id_idx ON workflow_step_runs (organization_id);
CREATE INDEX IF NOT EXISTS workflow_step_runs_run_id_idx ON workflow_step_runs (workflow_run_id);
CREATE INDEX IF NOT EXISTS workflow_step_runs_status_idx ON workflow_step_runs (workflow_step_status);
CREATE INDEX IF NOT EXISTS workflow_step_runs_run_node_idx ON workflow_step_runs (workflow_run_id, node_id);
CREATE INDEX IF NOT EXISTS workflow_step_runs_idempotency_key_idx ON workflow_step_runs (idempotency_key);

CREATE TABLE IF NOT EXISTS workflow_run_events (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  workflow_run_id VARCHAR(36) NOT NULL,
  step_run_id VARCHAR(36) NULL,
  type VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  payload TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT workflow_run_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT workflow_run_events_run_fk FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS workflow_run_events_organization_id_idx ON workflow_run_events (organization_id);
CREATE INDEX IF NOT EXISTS workflow_run_events_run_id_idx ON workflow_run_events (workflow_run_id);
CREATE INDEX IF NOT EXISTS workflow_run_events_created_at_idx ON workflow_run_events (created_at);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  result TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idempotency_records_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idempotency_records_org_key_idx ON idempotency_records (organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idempotency_records_key_unique_idx ON idempotency_records (idempotency_key);
