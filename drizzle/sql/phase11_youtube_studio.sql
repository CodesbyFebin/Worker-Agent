-- Phase 11 — YouTube Automation Studio

CREATE TABLE IF NOT EXISTS youtube_channels (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  youtube_channel_id VARCHAR(64) NULL,
  access_token_env_key VARCHAR(128) NOT NULL,
  refresh_token_env_key VARCHAR(128) NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  user_agent VARCHAR(512) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  niche VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT youtube_channels_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS youtube_channels_organization_id_idx ON youtube_channels (organization_id);
CREATE INDEX IF NOT EXISTS youtube_channels_is_active_idx ON youtube_channels (is_active);
CREATE INDEX IF NOT EXISTS youtube_channels_youtube_channel_id_idx ON youtube_channels (youtube_channel_id);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  channel_id VARCHAR(36) NOT NULL,
  workflow_run_id VARCHAR(36) NULL,
  youtube_video_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  topic VARCHAR(512) NULL,
  local_video_path TEXT NULL,
  thumbnail_path TEXT NULL,
  youtube_video_status ENUM(
    'draft','scripted','rendering','compliance_hold','scheduled',
    'uploading','uploaded','live','failed'
  ) NOT NULL DEFAULT 'draft',
  views INT NOT NULL DEFAULT 0,
  avg_view_duration DECIMAL(5,4) NULL,
  scheduled_at TIMESTAMP NULL,
  uploaded_at TIMESTAMP NULL,
  compliance_notes TEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT youtube_videos_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT youtube_videos_channel_fk FOREIGN KEY (channel_id) REFERENCES youtube_channels(id) ON DELETE CASCADE,
  CONSTRAINT youtube_videos_run_fk FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);
CREATE INDEX IF NOT EXISTS youtube_videos_organization_id_idx ON youtube_videos (organization_id);
CREATE INDEX IF NOT EXISTS youtube_videos_channel_id_idx ON youtube_videos (channel_id);
CREATE INDEX IF NOT EXISTS youtube_videos_status_idx ON youtube_videos (youtube_video_status);
CREATE INDEX IF NOT EXISTS youtube_videos_workflow_run_id_idx ON youtube_videos (workflow_run_id);

CREATE TABLE IF NOT EXISTS youtube_trends (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  query VARCHAR(512) NOT NULL,
  results_json TEXT NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'youtube_data_api',
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT youtube_trends_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS youtube_trends_organization_id_idx ON youtube_trends (organization_id);
CREATE INDEX IF NOT EXISTS youtube_trends_query_idx ON youtube_trends (query);
CREATE INDEX IF NOT EXISTS youtube_trends_fetched_at_idx ON youtube_trends (fetched_at);
