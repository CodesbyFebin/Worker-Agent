-- Phase 7 — Tool gateway, MCP registry, credential refs, invocations

CREATE TABLE IF NOT EXISTS credential_refs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  env_key VARCHAR(128) NOT NULL,
  description TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT credential_refs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT credential_refs_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS credential_refs_organization_id_idx ON credential_refs (organization_id);
CREATE INDEX IF NOT EXISTS credential_refs_provider_idx ON credential_refs (provider);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  mcp_transport ENUM('http','stdio') NOT NULL,
  endpoint TEXT NOT NULL,
  config TEXT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  last_discovered_at TIMESTAMP NULL,
  last_error TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT mcp_servers_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT mcp_servers_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS mcp_servers_organization_id_idx ON mcp_servers (organization_id);
CREATE INDEX IF NOT EXISTS mcp_servers_enabled_idx ON mcp_servers (enabled);

CREATE TABLE IF NOT EXISTS tool_definitions (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  tool_source ENUM('builtin','mcp') NOT NULL,
  mcp_server_id VARCHAR(36) NULL,
  input_schema TEXT NULL,
  required_permission VARCHAR(64) NOT NULL DEFAULT 'tool:invoke',
  credential_provider VARCHAR(64) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT tool_definitions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT tool_definitions_mcp_fk FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS tool_definitions_organization_id_idx ON tool_definitions (organization_id);
CREATE INDEX IF NOT EXISTS tool_definitions_name_idx ON tool_definitions (name);
CREATE INDEX IF NOT EXISTS tool_definitions_source_idx ON tool_definitions (tool_source);
CREATE INDEX IF NOT EXISTS tool_definitions_mcp_server_id_idx ON tool_definitions (mcp_server_id);

CREATE TABLE IF NOT EXISTS tool_gateway_policies (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  allowed_tools TEXT NOT NULL,
  allowed_mcp_server_ids TEXT NOT NULL,
  denied_tools TEXT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT tool_gateway_policies_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS tool_gateway_policies_organization_id_idx ON tool_gateway_policies (organization_id);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  tool_definition_id VARCHAR(36) NULL,
  mcp_server_id VARCHAR(36) NULL,
  actor_user_id VARCHAR(36) NULL,
  agent_execution_id VARCHAR(36) NULL,
  tool_invocation_status ENUM('queued','running','completed','failed','denied') NOT NULL DEFAULT 'queued',
  input TEXT NOT NULL,
  output TEXT NULL,
  error TEXT NULL,
  duration_ms INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  CONSTRAINT tool_invocations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT tool_invocations_tool_fk FOREIGN KEY (tool_definition_id) REFERENCES tool_definitions(id),
  CONSTRAINT tool_invocations_mcp_fk FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id),
  CONSTRAINT tool_invocations_user_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS tool_invocations_organization_id_idx ON tool_invocations (organization_id);
CREATE INDEX IF NOT EXISTS tool_invocations_tool_name_idx ON tool_invocations (tool_name);
CREATE INDEX IF NOT EXISTS tool_invocations_status_idx ON tool_invocations (tool_invocation_status);
CREATE INDEX IF NOT EXISTS tool_invocations_created_at_idx ON tool_invocations (created_at);
