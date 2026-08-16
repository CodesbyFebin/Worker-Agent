-- Additive run linkage + schema-backed trace identity.
-- Existing rows keep NULL; services enforce integrity for new Mission Control records.

ALTER TABLE agent_tasks
  ADD COLUMN run_id VARCHAR(36) NULL,
  ADD INDEX agent_tasks_run_idx (run_id);

ALTER TABLE mission_control_approvals
  ADD COLUMN run_id VARCHAR(36) NULL,
  ADD INDEX mc_approvals_run_idx (run_id);

ALTER TABLE workflow_runs
  ADD COLUMN trace_id VARCHAR(64) NULL,
  ADD INDEX workflow_runs_trace_idx (trace_id);
