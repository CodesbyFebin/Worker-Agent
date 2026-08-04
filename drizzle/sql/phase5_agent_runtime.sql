-- Phase 5 — Agent definitions, policies, executions, evaluations

CREATE TABLE IF NOT EXISTS prompt_definitions (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT prompt_definitions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS prompt_definitions_organization_id_idx ON prompt_definitions (organization_id);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id VARCHAR(36) PRIMARY KEY,
  prompt_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  system_prompt TEXT NOT NULL,
  change_summary VARCHAR(512) NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT prompt_versions_prompt_fk FOREIGN KEY (prompt_id) REFERENCES prompt_definitions(id) ON DELETE CASCADE,
  CONSTRAINT prompt_versions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT prompt_versions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS prompt_versions_prompt_id_idx ON prompt_versions (prompt_id);
CREATE INDEX IF NOT EXISTS prompt_versions_organization_id_idx ON prompt_versions (organization_id);

CREATE TABLE IF NOT EXISTS model_policies (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  policy_key VARCHAR(64) NOT NULL,
  preferred_provider VARCHAR(64) NULL,
  preferred_model VARCHAR(255) NULL,
  max_tokens INT NOT NULL DEFAULT 1024,
  temperature DECIMAL(3,2) DEFAULT 0.20,
  fallback_providers TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT model_policies_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS model_policies_organization_id_idx ON model_policies (organization_id);
CREATE INDEX IF NOT EXISTS model_policies_policy_key_idx ON model_policies (policy_key);

CREATE TABLE IF NOT EXISTS tool_policies (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  allowed_tools TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tool_policies_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS tool_policies_organization_id_idx ON tool_policies (organization_id);

CREATE TABLE IF NOT EXISTS agent_definitions (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  role VARCHAR(64) NOT NULL,
  current_version_id VARCHAR(36) NULL,
  agent_definition_status ENUM('draft','active','disabled') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT agent_definitions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT agent_definitions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS agent_definitions_organization_id_idx ON agent_definitions (organization_id);
CREATE INDEX IF NOT EXISTS agent_definitions_status_idx ON agent_definitions (agent_definition_status);
CREATE INDEX IF NOT EXISTS agent_definitions_role_idx ON agent_definitions (role);

CREATE TABLE IF NOT EXISTS agent_versions (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  prompt_version_id VARCHAR(36) NOT NULL,
  model_policy_id VARCHAR(36) NOT NULL,
  tool_policy_id VARCHAR(36) NOT NULL,
  capabilities TEXT NOT NULL,
  change_summary VARCHAR(512) NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agent_versions_agent_fk FOREIGN KEY (agent_id) REFERENCES agent_definitions(id) ON DELETE CASCADE,
  CONSTRAINT agent_versions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT agent_versions_prompt_fk FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id),
  CONSTRAINT agent_versions_model_fk FOREIGN KEY (model_policy_id) REFERENCES model_policies(id),
  CONSTRAINT agent_versions_tool_fk FOREIGN KEY (tool_policy_id) REFERENCES tool_policies(id),
  CONSTRAINT agent_versions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_id_idx ON agent_versions (agent_id);
CREATE INDEX IF NOT EXISTS agent_versions_organization_id_idx ON agent_versions (organization_id);
CREATE INDEX IF NOT EXISTS agent_versions_agent_version_idx ON agent_versions (agent_id, version);

CREATE TABLE IF NOT EXISTS agent_executions (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NULL,
  agent_version_id VARCHAR(36) NULL,
  workflow_run_id VARCHAR(36) NULL,
  workflow_step_run_id VARCHAR(36) NULL,
  model_provider VARCHAR(64) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  input TEXT NOT NULL,
  output TEXT NULL,
  decision_summary TEXT NULL,
  input_tokens INT NULL,
  output_tokens INT NULL,
  cost_usd DECIMAL(12,6) NULL,
  error TEXT NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agent_executions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT agent_executions_agent_fk FOREIGN KEY (agent_id) REFERENCES agent_definitions(id),
  CONSTRAINT agent_executions_version_fk FOREIGN KEY (agent_version_id) REFERENCES agent_versions(id)
);
CREATE INDEX IF NOT EXISTS agent_executions_organization_id_idx ON agent_executions (organization_id);
CREATE INDEX IF NOT EXISTS agent_executions_agent_id_idx ON agent_executions (agent_id);
CREATE INDEX IF NOT EXISTS agent_executions_agent_version_id_idx ON agent_executions (agent_version_id);
CREATE INDEX IF NOT EXISTS agent_executions_status_idx ON agent_executions (status);
CREATE INDEX IF NOT EXISTS agent_executions_workflow_run_id_idx ON agent_executions (workflow_run_id);

CREATE TABLE IF NOT EXISTS agent_evaluations (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  test_case TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agent_evaluations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT agent_evaluations_agent_fk FOREIGN KEY (agent_id) REFERENCES agent_definitions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS agent_evaluations_organization_id_idx ON agent_evaluations (organization_id);
CREATE INDEX IF NOT EXISTS agent_evaluations_agent_id_idx ON agent_evaluations (agent_id);

CREATE TABLE IF NOT EXISTS agent_evaluation_runs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  evaluation_id VARCHAR(36) NOT NULL,
  agent_version_id VARCHAR(36) NULL,
  agent_execution_id VARCHAR(36) NULL,
  passed TINYINT(1) NOT NULL,
  score DECIMAL(5,4) NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agent_evaluation_runs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT agent_evaluation_runs_eval_fk FOREIGN KEY (evaluation_id) REFERENCES agent_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT agent_evaluation_runs_version_fk FOREIGN KEY (agent_version_id) REFERENCES agent_versions(id),
  CONSTRAINT agent_evaluation_runs_exec_fk FOREIGN KEY (agent_execution_id) REFERENCES agent_executions(id)
);
CREATE INDEX IF NOT EXISTS agent_evaluation_runs_organization_id_idx ON agent_evaluation_runs (organization_id);
CREATE INDEX IF NOT EXISTS agent_evaluation_runs_evaluation_id_idx ON agent_evaluation_runs (evaluation_id);
