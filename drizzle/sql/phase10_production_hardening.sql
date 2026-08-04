-- Phase 10 — Dead-letter jobs

CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NULL,
  queue_name VARCHAR(128) NOT NULL,
  job_name VARCHAR(128) NULL,
  bullmq_job_id VARCHAR(64) NULL,
  payload TEXT NOT NULL,
  error_message TEXT NOT NULL,
  attempts_made INT NOT NULL DEFAULT 0,
  dead_letter_status ENUM('open','retried','discarded') NOT NULL DEFAULT 'open',
  resolved_by VARCHAR(36) NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dead_letter_jobs_user_fk FOREIGN KEY (resolved_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS dead_letter_jobs_organization_id_idx ON dead_letter_jobs (organization_id);
CREATE INDEX IF NOT EXISTS dead_letter_jobs_status_idx ON dead_letter_jobs (dead_letter_status);
CREATE INDEX IF NOT EXISTS dead_letter_jobs_queue_name_idx ON dead_letter_jobs (queue_name);
CREATE INDEX IF NOT EXISTS dead_letter_jobs_created_at_idx ON dead_letter_jobs (created_at);
