-- Phase 12 — Knowledge layer (semantic search + embeddings)

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(64) NOT NULL COMMENT 'artifact | script | trend | prompt | brand_guideline | winning_pattern',
  entity_id VARCHAR(36) NOT NULL,
  metadata TEXT NULL,
  embedding_json TEXT NOT NULL COMMENT 'JSON array of floats',
  model VARCHAR(128) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  embedding_backend ENUM('local_sentence_transformers','pinecone','milvus','openai') NOT NULL DEFAULT 'local_sentence_transformers',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_embeddings_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_organization_id_idx ON knowledge_embeddings (organization_id);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_entity_idx ON knowledge_embeddings (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_backend_idx ON knowledge_embeddings (embedding_backend);

CREATE TABLE IF NOT EXISTS topic_taxonomies (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT NULL,
  parent_id VARCHAR(36) NULL,
  properties TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT topic_taxonomies_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT topic_taxonomies_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS topic_taxonomies_organization_id_idx ON topic_taxonomies (organization_id);
CREATE INDEX IF NOT EXISTS topic_taxonomies_slug_idx ON topic_taxonomies (slug);
CREATE INDEX IF NOT EXISTS topic_taxonomies_parent_id_idx ON topic_taxonomies (parent_id);

CREATE TABLE IF NOT EXISTS brand_guidelines (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  voice TEXT NULL,
  style TEXT NULL,
  terminology TEXT NULL,
  approved_claims TEXT NULL,
  disallowed_claims TEXT NULL,
  logo_usage TEXT NULL,
  color_palette TEXT NULL,
  typography TEXT NULL,
  messaging TEXT NULL,
  compliance_rules TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT brand_guidelines_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT brand_guidelines_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS brand_guidelines_organization_id_idx ON brand_guidelines (organization_id);

CREATE TABLE IF NOT EXISTS winning_patterns (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  source_video_id VARCHAR(36) NULL,
  source_script_id VARCHAR(36) NULL,
  content_type VARCHAR(64) NOT NULL,
  topic_tags TEXT NULL,
  pattern_json TEXT NOT NULL,
  performance TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT winning_patterns_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT winning_patterns_video_fk FOREIGN KEY (source_video_id) REFERENCES youtube_videos(id) ON DELETE SET NULL,
  CONSTRAINT winning_patterns_script_fk FOREIGN KEY (source_script_id) REFERENCES scripts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS winning_patterns_organization_id_idx ON winning_patterns (organization_id);
CREATE INDEX IF NOT EXISTS winning_patterns_content_type_idx ON winning_patterns (content_type);
CREATE INDEX IF NOT EXISTS winning_patterns_source_video_id_idx ON winning_patterns (source_video_id);
CREATE INDEX IF NOT EXISTS winning_patterns_source_script_id_idx ON winning_patterns (source_script_id);

CREATE TABLE IF NOT EXISTS research_archive (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  topic VARCHAR(512) NOT NULL,
  source VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  confidence_score DECIMAL(4,3) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT research_archive_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS research_archive_organization_id_idx ON research_archive (organization_id);
CREATE INDEX IF NOT EXISTS research_archive_topic_idx ON research_archive (topic);
CREATE INDEX IF NOT EXISTS research_archive_source_idx ON research_archive (source);
