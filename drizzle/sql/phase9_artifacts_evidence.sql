-- Phase 9 — Artifacts, versions, evidence snapshots & sources

CREATE TABLE IF NOT EXISTS artifacts (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  artifact_kind ENUM('evidence','document','media','snapshot','other') NOT NULL DEFAULT 'other',
  content_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  current_version_id VARCHAR(36) NULL,
  claim_id VARCHAR(36) NULL,
  campaign_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT artifacts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT artifacts_claim_fk FOREIGN KEY (claim_id) REFERENCES claim_ledger(id) ON DELETE SET NULL,
  CONSTRAINT artifacts_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS artifacts_organization_id_idx ON artifacts (organization_id);
CREATE INDEX IF NOT EXISTS artifacts_claim_id_idx ON artifacts (claim_id);
CREATE INDEX IF NOT EXISTS artifacts_kind_idx ON artifacts (artifact_kind);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id VARCHAR(36) PRIMARY KEY,
  artifact_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  storage_backend ENUM('s3','local') NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NOT NULL,
  metadata TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT artifact_versions_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  CONSTRAINT artifact_versions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT artifact_versions_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS artifact_versions_artifact_id_idx ON artifact_versions (artifact_id);
CREATE INDEX IF NOT EXISTS artifact_versions_organization_id_idx ON artifact_versions (organization_id);
CREATE INDEX IF NOT EXISTS artifact_versions_artifact_version_idx ON artifact_versions (artifact_id, version);

CREATE TABLE IF NOT EXISTS evidence_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  claim_id VARCHAR(36) NOT NULL,
  verification_status VARCHAR(32) NOT NULL,
  confidence_score DECIMAL(4,3) NULL,
  notes TEXT NULL,
  artifact_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evidence_snapshots_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT evidence_snapshots_claim_fk FOREIGN KEY (claim_id) REFERENCES claim_ledger(id) ON DELETE CASCADE,
  CONSTRAINT evidence_snapshots_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  CONSTRAINT evidence_snapshots_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS evidence_snapshots_organization_id_idx ON evidence_snapshots (organization_id);
CREATE INDEX IF NOT EXISTS evidence_snapshots_claim_id_idx ON evidence_snapshots (claim_id);
CREATE INDEX IF NOT EXISTS evidence_snapshots_created_at_idx ON evidence_snapshots (created_at);

CREATE TABLE IF NOT EXISTS evidence_sources (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  snapshot_id VARCHAR(36) NOT NULL,
  source_url VARCHAR(1024) NOT NULL,
  supporting_sentence TEXT NULL,
  relevance_score DECIMAL(4,3) NULL,
  freshness_score DECIMAL(4,3) NULL,
  http_status INT NULL,
  content_hash VARCHAR(64) NULL,
  fetched_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evidence_sources_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT evidence_sources_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES evidence_snapshots(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS evidence_sources_organization_id_idx ON evidence_sources (organization_id);
CREATE INDEX IF NOT EXISTS evidence_sources_snapshot_id_idx ON evidence_sources (snapshot_id);
CREATE INDEX IF NOT EXISTS evidence_sources_source_url_idx ON evidence_sources (source_url);
