-- Phase 8 — Approvals, governance, budgets, security events

CREATE TABLE IF NOT EXISTS governance_policies (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  rules TEXT NOT NULL,
  require_human_review TINYINT(1) NOT NULL DEFAULT 1,
  pause_unsupported_claims TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT governance_policies_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT governance_policies_user_fk FOREIGN KEY (updated_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS governance_policies_organization_id_idx ON governance_policies (organization_id);

CREATE TABLE IF NOT EXISTS approval_requests (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  title VARCHAR(512) NOT NULL,
  summary TEXT NULL,
  payload TEXT NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  approval_status ENUM('pending','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(36) NULL,
  decided_by VARCHAR(36) NULL,
  decision_note TEXT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  CONSTRAINT approval_requests_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT approval_requests_requested_fk FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT approval_requests_decided_fk FOREIGN KEY (decided_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS approval_requests_organization_id_idx ON approval_requests (organization_id);
CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON approval_requests (approval_status);
CREATE INDEX IF NOT EXISTS approval_requests_resource_idx ON approval_requests (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS approval_requests_created_at_idx ON approval_requests (created_at);

CREATE TABLE IF NOT EXISTS org_budgets (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  period VARCHAR(32) NOT NULL DEFAULT 'monthly',
  limit_usd DECIMAL(12,4) NOT NULL,
  enforcement VARCHAR(16) NOT NULL DEFAULT 'hard',
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  updated_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT org_budgets_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT org_budgets_user_fk FOREIGN KEY (updated_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS org_budgets_organization_id_idx ON org_budgets (organization_id);

CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NULL,
  security_severity ENUM('info','low','medium','high','critical') NOT NULL DEFAULT 'info',
  kind VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  actor_user_id VARCHAR(36) NULL,
  resource_type VARCHAR(64) NULL,
  resource_id VARCHAR(64) NULL,
  payload TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT security_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT security_events_user_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS security_events_organization_id_idx ON security_events (organization_id);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON security_events (security_severity);
CREATE INDEX IF NOT EXISTS security_events_kind_idx ON security_events (kind);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events (created_at);
