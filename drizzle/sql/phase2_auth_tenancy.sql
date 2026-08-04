-- Phase 2 auth/tenancy schema (idempotent where possible)

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NULL,
  role_slug ENUM('owner','admin','member','viewer') NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS roles_organization_id_idx ON roles (organization_id);
CREATE INDEX IF NOT EXISTS roles_slug_idx ON roles (role_slug);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY,
  `key` VARCHAR(128) NOT NULL UNIQUE,
  description VARCHAR(512) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_id VARCHAR(36) NOT NULL,
  CONSTRAINT role_permissions_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_id_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS role_permissions_role_perm_idx ON role_permissions (role_id, permission_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON role_permissions (role_id);

CREATE TABLE IF NOT EXISTS organization_members (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT organization_members_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT organization_members_role_fk FOREIGN KEY (role_id) REFERENCES roles(id)
);
CREATE INDEX IF NOT EXISTS organization_members_org_id_idx ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS organization_members_org_user_idx ON organization_members (organization_id, user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent VARCHAR(512) NULL,
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sessions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_organization_id_idx ON sessions (organization_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NULL,
  actor_user_id VARCHAR(36) NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NULL,
  resource_id VARCHAR(64) NULL,
  payload TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_organization_id_idx ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

-- Add organization_id columns (nullable for backfill)
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;
ALTER TABLE claim_ledger ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;
ALTER TABLE content_campaigns ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;
ALTER TABLE content_ops_pipelines ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) NULL;

CREATE INDEX IF NOT EXISTS scripts_organization_id_idx ON scripts (organization_id);
CREATE INDEX IF NOT EXISTS scripts_user_id_idx ON scripts (user_id);
CREATE INDEX IF NOT EXISTS claim_ledger_organization_id_idx ON claim_ledger (organization_id);
CREATE INDEX IF NOT EXISTS agent_tasks_organization_id_idx ON agent_tasks (organization_id);
CREATE INDEX IF NOT EXISTS content_campaigns_organization_id_idx ON content_campaigns (organization_id);
CREATE INDEX IF NOT EXISTS content_campaigns_user_id_idx ON content_campaigns (user_id);
CREATE INDEX IF NOT EXISTS content_ops_pipelines_organization_id_idx ON content_ops_pipelines (organization_id);
CREATE INDEX IF NOT EXISTS agent_events_organization_id_idx ON agent_events (organization_id);
