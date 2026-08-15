CREATE TABLE `agent_definitions` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`role` varchar(64) NOT NULL,
	`current_version_id` varchar(36),
	`agent_definition_status` enum('draft','active','disabled') NOT NULL DEFAULT 'draft',
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_evaluation_runs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`evaluation_id` varchar(36) NOT NULL,
	`agent_version_id` varchar(36),
	`agent_execution_id` varchar(36),
	`passed` boolean NOT NULL,
	`score` decimal(5,4),
	`details` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_evaluation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_evaluations` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`agent_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`test_case` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`task_id` varchar(36) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_executions` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`agent_id` varchar(36),
	`agent_version_id` varchar(36),
	`workflow_run_id` varchar(36),
	`workflow_step_run_id` varchar(36),
	`model_provider` varchar(64) NOT NULL,
	`model_name` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`decision_summary` text,
	`input_tokens` int,
	`output_tokens` int,
	`cost_usd` decimal(12,6),
	`error` text,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tasks` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`parent_task_id` varchar(36),
	`script_id` varchar(36),
	`campaign_id` varchar(36),
	`day_index` int,
	`agent_role` enum('planner','researcher','writer','reviewer','coder','qa','publisher','video_generator','video_editor','voiceover','caption_hashtag','seo') NOT NULL,
	`title` varchar(255) NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`payload` text NOT NULL,
	`result` text,
	`worktree_id` varchar(36),
	`status` enum('pending','assigned','running','awaiting_approval','blocked','completed','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`input_tokens` int,
	`output_tokens` int,
	`cost_usd` decimal(10,6),
	`scheduled_at` timestamp,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_versions` (
	`id` varchar(36) NOT NULL,
	`agent_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`prompt_version_id` varchar(36) NOT NULL,
	`model_policy_id` varchar(36) NOT NULL,
	`tool_policy_id` varchar(36) NOT NULL,
	`capabilities` text NOT NULL,
	`change_summary` varchar(512),
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_worktrees` (
	`id` varchar(36) NOT NULL,
	`branch_name` varchar(255) NOT NULL,
	`path` varchar(1024) NOT NULL,
	`agent_department` enum('planner','researcher','writer','reviewer','coder','qa','publisher','video_generator','video_editor','voiceover','caption_hashtag','seo') NOT NULL,
	`is_locked` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`removed_at` timestamp,
	CONSTRAINT `agent_worktrees_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_worktrees_branch_name_unique` UNIQUE(`branch_name`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`prefix` varchar(64) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` timestamp,
	`revoked_at` timestamp,
	`last_used_at` timestamp,
	`last_rotated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_prefix_unique` UNIQUE(`prefix`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`resource_type` varchar(64) NOT NULL,
	`resource_id` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`summary` text,
	`payload` text NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`approval_status` enum('pending','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(36),
	`decided_by` varchar(36),
	`decision_note` text,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`decided_at` timestamp,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifact_versions` (
	`id` varchar(36) NOT NULL,
	`artifact_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`storage_backend` enum('s3','local') NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`size_bytes` int NOT NULL DEFAULT 0,
	`checksum_sha256` varchar(64) NOT NULL,
	`metadata` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifact_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`artifact_kind` enum('evidence','document','media','snapshot','other') NOT NULL DEFAULT 'other',
	`content_type` varchar(128) NOT NULL DEFAULT 'application/octet-stream',
	`current_version_id` varchar(36),
	`claim_id` varchar(36),
	`campaign_id` varchar(36),
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`actor_user_id` varchar(36),
	`action` varchar(128) NOT NULL,
	`resource_type` varchar(64),
	`resource_id` varchar(64),
	`payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_guidelines` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`voice` text,
	`style` text,
	`terminology` text,
	`approved_claims` text,
	`disallowed_claims` text,
	`logo_usage` text,
	`color_palette` text,
	`typography` text,
	`messaging` text,
	`compliance_rules` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_guidelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_ledger` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`script_id` varchar(36),
	`devtag` varchar(64) NOT NULL,
	`claim_text` text NOT NULL,
	`source_url` varchar(1024),
	`confidence_score` decimal(4,3),
	`verification_status` enum('pending','verified','rejected','unverifiable') NOT NULL DEFAULT 'pending',
	`is_immutable` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_ledger_devtag_unique` UNIQUE(`devtag`)
);
--> statement-breakpoint
CREATE TABLE `compliance_verdicts` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`resource_type` enum('script','video','comment','campaign','metadata') NOT NULL,
	`resource_id` varchar(36) NOT NULL,
	`check_key` varchar(64) NOT NULL,
	`verdict` enum('pass','review','block') NOT NULL,
	`evidence_json` text NOT NULL,
	`policy_version` int NOT NULL DEFAULT 1,
	`checked_by` enum('engine','human') NOT NULL DEFAULT 'engine',
	`decided_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	CONSTRAINT `compliance_verdicts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_campaigns` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`topic` varchar(500) NOT NULL,
	`total_days` int NOT NULL,
	`start_date` timestamp NOT NULL,
	`campaign_status` enum('planning','active','paused','completed') NOT NULL DEFAULT 'planning',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_ops_pipelines` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`script_id` varchar(36) NOT NULL,
	`root_task_id` varchar(36),
	`campaign_id` varchar(36),
	`title` varchar(255) NOT NULL,
	`pipeline_stage` enum('god_machine','script_studio','evidence','research_to_post','workspace','youtube_autopilot','social','approvals','publishing','done') NOT NULL DEFAULT 'god_machine',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_ops_pipelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credential_refs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`env_key` varchar(128) NOT NULL,
	`description` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credential_refs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dead_letter_jobs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`queue_name` varchar(128) NOT NULL,
	`job_name` varchar(128),
	`bullmq_job_id` varchar(64),
	`payload` text NOT NULL,
	`error_message` text NOT NULL,
	`attempts_made` int NOT NULL DEFAULT 0,
	`dead_letter_status` enum('open','retried','discarded') NOT NULL DEFAULT 'open',
	`resolved_by` varchar(36),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dead_letter_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_snapshots` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`claim_id` varchar(36) NOT NULL,
	`verification_status` varchar(32) NOT NULL,
	`confidence_score` decimal(4,3),
	`notes` text,
	`artifact_id` varchar(36),
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_sources` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`snapshot_id` varchar(36) NOT NULL,
	`source_url` varchar(1024) NOT NULL,
	`supporting_sentence` text,
	`relevance_score` decimal(4,3),
	`freshness_score` decimal(4,3),
	`http_status` int,
	`content_hash` varchar(64),
	`fetched_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_metadata` (
	`id` varchar(36) NOT NULL,
	`script_id` varchar(36) NOT NULL,
	`titles` text NOT NULL,
	`description` text NOT NULL,
	`tags` text NOT NULL,
	`thumbnail_prompt` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_metadata_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governance_policies` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`rules` text NOT NULL,
	`require_human_review` boolean NOT NULL DEFAULT true,
	`pause_unsupported_claims` boolean NOT NULL DEFAULT true,
	`updated_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governance_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`resource_type` varchar(64) NOT NULL,
	`resource_id` varchar(64) NOT NULL,
	`result` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_embeddings` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`metadata` text,
	`embedding_json` text NOT NULL,
	`model` varchar(128) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
	`embedding_backend` enum('local_sentence_transformers','pinecone','milvus','openai') NOT NULL DEFAULT 'local_sentence_transformers',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`mcp_transport` enum('http','stdio') NOT NULL,
	`endpoint` text NOT NULL,
	`config` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`last_discovered_at` timestamp,
	`last_error` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_servers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mfa_backup_codes` (
	`id` varchar(36) NOT NULL,
	`factor_id` varchar(36) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_backup_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mfa_factors` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`mfa_type` enum('totp','webauthn','sms') NOT NULL,
	`secret` varchar(255) NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_factors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_policies` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`policy_key` varchar(64) NOT NULL,
	`preferred_provider` varchar(64),
	`preferred_model` varchar(255),
	`max_tokens` int NOT NULL DEFAULT 1024,
	`temperature` decimal(3,2) DEFAULT '0.20',
	`fallback_providers` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_budgets` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`period` varchar(32) NOT NULL DEFAULT 'monthly',
	`limit_usd` decimal(12,4) NOT NULL,
	`enforcement` varchar(16) NOT NULL DEFAULT 'hard',
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`updated_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` varchar(36) NOT NULL,
	`key` varchar(128) NOT NULL,
	`description` varchar(512) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `prompt_definitions` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` varchar(36) NOT NULL,
	`prompt_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`system_prompt` text NOT NULL,
	`change_summary` varchar(512),
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quota_ledger` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`channel_ref` varchar(64),
	`operation` varchar(128) NOT NULL,
	`quota_units` int NOT NULL,
	`request_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quota_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_archive` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`topic` varchar(512) NOT NULL,
	`source` varchar(64) NOT NULL,
	`payload` text NOT NULL,
	`confidence_score` decimal(4,3),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_archive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` varchar(36) NOT NULL,
	`permission_id` varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`role_slug` enum('owner','admin','member','viewer') NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `script_sections` (
	`id` varchar(36) NOT NULL,
	`script_id` varchar(36) NOT NULL,
	`kind` enum('hook','body','cta','outro','custom') NOT NULL,
	`order` int NOT NULL,
	`content` text NOT NULL,
	`word_count` int NOT NULL DEFAULT 0,
	`last_regenerated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `script_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`full_text` text NOT NULL,
	`target_duration_seconds` int DEFAULT 60,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`security_severity` enum('info','low','medium','high','critical') NOT NULL DEFAULT 'info',
	`kind` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`actor_user_id` varchar(36),
	`resource_type` varchar(64),
	`resource_id` varchar(64),
	`payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`user_agent` varchar(512),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `tool_definitions` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`tool_source` enum('builtin','mcp') NOT NULL,
	`mcp_server_id` varchar(36),
	`input_schema` text,
	`required_permission` varchar(64) NOT NULL DEFAULT 'tool:invoke',
	`credential_provider` varchar(64),
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tool_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_gateway_policies` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`allowed_tools` text NOT NULL,
	`allowed_mcp_server_ids` text NOT NULL,
	`denied_tools` text NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tool_gateway_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_invocations` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`tool_name` varchar(255) NOT NULL,
	`tool_definition_id` varchar(36),
	`mcp_server_id` varchar(36),
	`actor_user_id` varchar(36),
	`agent_execution_id` varchar(36),
	`tool_invocation_status` enum('queued','running','completed','failed','denied') NOT NULL DEFAULT 'queued',
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`duration_ms` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `tool_invocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_policies` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`allowed_tools` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tool_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topic_taxonomies` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`parent_id` varchar(36),
	`properties` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topic_taxonomies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_credentials` (
	`user_id` varchar(36) NOT NULL,
	`password_hash` text NOT NULL,
	`password_updated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`display_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `vault_secrets` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`vault_provider` enum('hashicorp','doppler','env') NOT NULL,
	`path` varchar(512) NOT NULL,
	`encrypted_value` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`created_by` varchar(36),
	`expires_at` timestamp,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_secrets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`target_url` text NOT NULL,
	`secret_hash` varchar(64) NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `winning_patterns` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`source_video_id` varchar(36),
	`source_script_id` varchar(36),
	`content_type` varchar(64) NOT NULL,
	`topic_tags` text,
	`pattern_json` text NOT NULL,
	`performance` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `winning_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_definitions` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`current_version_id` varchar(36),
	`workflow_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_run_events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`workflow_run_id` varchar(36) NOT NULL,
	`step_run_id` varchar(36),
	`type` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_run_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`workflow_id` varchar(36) NOT NULL,
	`workflow_version_id` varchar(36) NOT NULL,
	`workflow_run_status` enum('created','queued','running','paused','awaiting_approval','completed','completed_with_warnings','failed','cancelled','expired') NOT NULL DEFAULT 'created',
	`trigger_type` varchar(64) NOT NULL DEFAULT 'manual',
	`input` text,
	`output` text,
	`error_message` text,
	`started_by` varchar(36),
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_step_runs` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`workflow_run_id` varchar(36) NOT NULL,
	`node_id` varchar(128) NOT NULL,
	`node_type` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`workflow_step_status` enum('pending','queued','assigned','running','waiting','awaiting_input','awaiting_approval','retrying','blocked','cancel_requested','cancelled','completed','failed','expired','skipped') NOT NULL DEFAULT 'pending',
	`attempt` int NOT NULL DEFAULT 0,
	`input` text,
	`output` text,
	`error_message` text,
	`decision_summary` text,
	`idempotency_key` varchar(255),
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_step_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_versions` (
	`id` varchar(36) NOT NULL,
	`workflow_id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`graph` text NOT NULL,
	`input_schema` text,
	`output_schema` text,
	`change_summary` varchar(512),
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_channels` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`channel_name` varchar(255) NOT NULL,
	`youtube_channel_id` varchar(64),
	`access_token_env_key` varchar(128) NOT NULL,
	`refresh_token_env_key` varchar(128),
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`user_agent` varchar(512),
	`is_active` boolean NOT NULL DEFAULT true,
	`niche` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_trends` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`query` varchar(512) NOT NULL,
	`results_json` text NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'youtube_data_api',
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `youtube_trends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_videos` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`channel_id` varchar(36) NOT NULL,
	`workflow_run_id` varchar(36),
	`youtube_video_id` varchar(64),
	`title` varchar(255) NOT NULL,
	`description` text,
	`topic` varchar(512),
	`local_video_path` text,
	`thumbnail_path` text,
	`youtube_video_status` enum('draft','scripted','rendering','compliance_hold','scheduled','uploading','uploaded','live','failed') NOT NULL DEFAULT 'draft',
	`views` int NOT NULL DEFAULT 0,
	`avg_view_duration` decimal(5,4),
	`scheduled_at` timestamp,
	`uploaded_at` timestamp,
	`compliance_notes` text,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_definitions` ADD CONSTRAINT `agent_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_definitions` ADD CONSTRAINT `agent_definitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluation_runs` ADD CONSTRAINT `agent_evaluation_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluation_runs` ADD CONSTRAINT `agent_evaluation_runs_evaluation_id_agent_evaluations_id_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `agent_evaluations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluation_runs` ADD CONSTRAINT `agent_evaluation_runs_agent_version_id_agent_versions_id_fk` FOREIGN KEY (`agent_version_id`) REFERENCES `agent_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluation_runs` ADD CONSTRAINT `agent_evaluation_runs_agent_execution_id_agent_executions_id_fk` FOREIGN KEY (`agent_execution_id`) REFERENCES `agent_executions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluations` ADD CONSTRAINT `agent_evaluations_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_evaluations` ADD CONSTRAINT `agent_evaluations_agent_id_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_events` ADD CONSTRAINT `agent_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_agent_id_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD CONSTRAINT `agent_executions_agent_version_id_agent_versions_id_fk` FOREIGN KEY (`agent_version_id`) REFERENCES `agent_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_tasks` ADD CONSTRAINT `agent_tasks_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_tasks` ADD CONSTRAINT `agent_tasks_script_id_scripts_id_fk` FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_agent_id_agent_definitions_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_prompt_version_id_prompt_versions_id_fk` FOREIGN KEY (`prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_model_policy_id_model_policies_id_fk` FOREIGN KEY (`model_policy_id`) REFERENCES `model_policies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_tool_policy_id_tool_policies_id_fk` FOREIGN KEY (`tool_policy_id`) REFERENCES `tool_policies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_versions` ADD CONSTRAINT `agent_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifact_versions` ADD CONSTRAINT `artifact_versions_artifact_id_artifacts_id_fk` FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifact_versions` ADD CONSTRAINT `artifact_versions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifact_versions` ADD CONSTRAINT `artifact_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_claim_id_claim_ledger_id_fk` FOREIGN KEY (`claim_id`) REFERENCES `claim_ledger`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brand_guidelines` ADD CONSTRAINT `brand_guidelines_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brand_guidelines` ADD CONSTRAINT `brand_guidelines_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_ledger` ADD CONSTRAINT `claim_ledger_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_ledger` ADD CONSTRAINT `claim_ledger_script_id_scripts_id_fk` FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_verdicts` ADD CONSTRAINT `compliance_verdicts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_verdicts` ADD CONSTRAINT `compliance_verdicts_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_campaigns` ADD CONSTRAINT `content_campaigns_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_campaigns` ADD CONSTRAINT `content_campaigns_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_ops_pipelines` ADD CONSTRAINT `content_ops_pipelines_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_ops_pipelines` ADD CONSTRAINT `content_ops_pipelines_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_ops_pipelines` ADD CONSTRAINT `content_ops_pipelines_script_id_scripts_id_fk` FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credential_refs` ADD CONSTRAINT `credential_refs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credential_refs` ADD CONSTRAINT `credential_refs_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dead_letter_jobs` ADD CONSTRAINT `dead_letter_jobs_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_snapshots` ADD CONSTRAINT `evidence_snapshots_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_snapshots` ADD CONSTRAINT `evidence_snapshots_claim_id_claim_ledger_id_fk` FOREIGN KEY (`claim_id`) REFERENCES `claim_ledger`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_snapshots` ADD CONSTRAINT `evidence_snapshots_artifact_id_artifacts_id_fk` FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_snapshots` ADD CONSTRAINT `evidence_snapshots_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_snapshot_id_evidence_snapshots_id_fk` FOREIGN KEY (`snapshot_id`) REFERENCES `evidence_snapshots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generated_metadata` ADD CONSTRAINT `generated_metadata_script_id_scripts_id_fk` FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `governance_policies` ADD CONSTRAINT `governance_policies_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `governance_policies` ADD CONSTRAINT `governance_policies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_embeddings` ADD CONSTRAINT `knowledge_embeddings_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mcp_servers` ADD CONSTRAINT `mcp_servers_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mcp_servers` ADD CONSTRAINT `mcp_servers_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mfa_backup_codes` ADD CONSTRAINT `mfa_backup_codes_factor_id_mfa_factors_id_fk` FOREIGN KEY (`factor_id`) REFERENCES `mfa_factors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mfa_factors` ADD CONSTRAINT `mfa_factors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_policies` ADD CONSTRAINT `model_policies_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `org_budgets` ADD CONSTRAINT `org_budgets_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `org_budgets` ADD CONSTRAINT `org_budgets_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prompt_definitions` ADD CONSTRAINT `prompt_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_prompt_id_prompt_definitions_id_fk` FOREIGN KEY (`prompt_id`) REFERENCES `prompt_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prompt_versions` ADD CONSTRAINT `prompt_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quota_ledger` ADD CONSTRAINT `quota_ledger_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_archive` ADD CONSTRAINT `research_archive_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `script_sections` ADD CONSTRAINT `script_sections_script_id_scripts_id_fk` FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scripts` ADD CONSTRAINT `scripts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scripts` ADD CONSTRAINT `scripts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_definitions` ADD CONSTRAINT `tool_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_definitions` ADD CONSTRAINT `tool_definitions_mcp_server_id_mcp_servers_id_fk` FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_gateway_policies` ADD CONSTRAINT `tool_gateway_policies_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_invocations` ADD CONSTRAINT `tool_invocations_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_invocations` ADD CONSTRAINT `tool_invocations_tool_definition_id_tool_definitions_id_fk` FOREIGN KEY (`tool_definition_id`) REFERENCES `tool_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_invocations` ADD CONSTRAINT `tool_invocations_mcp_server_id_mcp_servers_id_fk` FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_invocations` ADD CONSTRAINT `tool_invocations_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tool_policies` ADD CONSTRAINT `tool_policies_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `topic_taxonomies` ADD CONSTRAINT `topic_taxonomies_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `topic_taxonomies` ADD CONSTRAINT `topic_taxonomies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_credentials` ADD CONSTRAINT `user_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD CONSTRAINT `vault_secrets_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD CONSTRAINT `vault_secrets_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `winning_patterns` ADD CONSTRAINT `winning_patterns_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `winning_patterns` ADD CONSTRAINT `winning_patterns_source_video_id_youtube_videos_id_fk` FOREIGN KEY (`source_video_id`) REFERENCES `youtube_videos`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `winning_patterns` ADD CONSTRAINT `winning_patterns_source_script_id_scripts_id_fk` FOREIGN KEY (`source_script_id`) REFERENCES `scripts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_definitions` ADD CONSTRAINT `workflow_definitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_run_events` ADD CONSTRAINT `workflow_run_events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_run_events` ADD CONSTRAINT `workflow_run_events_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_workflow_id_workflow_definitions_id_fk` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_workflow_version_id_workflow_versions_id_fk` FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_started_by_users_id_fk` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_step_runs` ADD CONSTRAINT `workflow_step_runs_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_workflow_id_workflow_definitions_id_fk` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD CONSTRAINT `workflow_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtube_channels` ADD CONSTRAINT `youtube_channels_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtube_trends` ADD CONSTRAINT `youtube_trends_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtube_videos` ADD CONSTRAINT `youtube_videos_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtube_videos` ADD CONSTRAINT `youtube_videos_channel_id_youtube_channels_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtube_videos` ADD CONSTRAINT `youtube_videos_workflow_run_id_workflow_runs_id_fk` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_definitions_organization_id_idx` ON `agent_definitions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_definitions_status_idx` ON `agent_definitions` (`agent_definition_status`);--> statement-breakpoint
CREATE INDEX `agent_definitions_role_idx` ON `agent_definitions` (`role`);--> statement-breakpoint
CREATE INDEX `agent_evaluation_runs_organization_id_idx` ON `agent_evaluation_runs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_evaluation_runs_evaluation_id_idx` ON `agent_evaluation_runs` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `agent_evaluations_organization_id_idx` ON `agent_evaluations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_evaluations_agent_id_idx` ON `agent_evaluations` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_events_organization_id_idx` ON `agent_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_events_task_id_idx` ON `agent_events` (`task_id`);--> statement-breakpoint
CREATE INDEX `agent_executions_organization_id_idx` ON `agent_executions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_executions_agent_id_idx` ON `agent_executions` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_executions_agent_version_id_idx` ON `agent_executions` (`agent_version_id`);--> statement-breakpoint
CREATE INDEX `agent_executions_status_idx` ON `agent_executions` (`status`);--> statement-breakpoint
CREATE INDEX `agent_executions_workflow_run_id_idx` ON `agent_executions` (`workflow_run_id`);--> statement-breakpoint
CREATE INDEX `agent_tasks_organization_id_idx` ON `agent_tasks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_tasks_parent_task_id_idx` ON `agent_tasks` (`parent_task_id`);--> statement-breakpoint
CREATE INDEX `agent_tasks_script_id_idx` ON `agent_tasks` (`script_id`);--> statement-breakpoint
CREATE INDEX `agent_tasks_status_idx` ON `agent_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `agent_tasks_campaign_id_idx` ON `agent_tasks` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `agent_versions_agent_id_idx` ON `agent_versions` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_versions_organization_id_idx` ON `agent_versions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `agent_versions_agent_version_idx` ON `agent_versions` (`agent_id`,`version`);--> statement-breakpoint
CREATE INDEX `agent_worktrees_department_idx` ON `agent_worktrees` (`agent_department`);--> statement-breakpoint
CREATE INDEX `api_keys_user_id_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_organization_id_idx` ON `api_keys` (`organization_id`);--> statement-breakpoint
CREATE INDEX `api_keys_prefix_idx` ON `api_keys` (`prefix`);--> statement-breakpoint
CREATE INDEX `api_keys_expires_at_idx` ON `api_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `approval_requests_organization_id_idx` ON `approval_requests` (`organization_id`);--> statement-breakpoint
CREATE INDEX `approval_requests_status_idx` ON `approval_requests` (`approval_status`);--> statement-breakpoint
CREATE INDEX `approval_requests_resource_idx` ON `approval_requests` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `approval_requests_created_at_idx` ON `approval_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `artifact_versions_artifact_id_idx` ON `artifact_versions` (`artifact_id`);--> statement-breakpoint
CREATE INDEX `artifact_versions_organization_id_idx` ON `artifact_versions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `artifact_versions_artifact_version_idx` ON `artifact_versions` (`artifact_id`,`version`);--> statement-breakpoint
CREATE INDEX `artifacts_organization_id_idx` ON `artifacts` (`organization_id`);--> statement-breakpoint
CREATE INDEX `artifacts_claim_id_idx` ON `artifacts` (`claim_id`);--> statement-breakpoint
CREATE INDEX `artifacts_kind_idx` ON `artifacts` (`artifact_kind`);--> statement-breakpoint
CREATE INDEX `audit_logs_organization_id_idx` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `brand_guidelines_organization_id_idx` ON `brand_guidelines` (`organization_id`);--> statement-breakpoint
CREATE INDEX `claim_ledger_organization_id_idx` ON `claim_ledger` (`organization_id`);--> statement-breakpoint
CREATE INDEX `claim_ledger_script_id_idx` ON `claim_ledger` (`script_id`);--> statement-breakpoint
CREATE INDEX `claim_ledger_devtag_idx` ON `claim_ledger` (`devtag`);--> statement-breakpoint
CREATE INDEX `compliance_verdicts_organization_id_idx` ON `compliance_verdicts` (`organization_id`);--> statement-breakpoint
CREATE INDEX `compliance_verdicts_resource_idx` ON `compliance_verdicts` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `compliance_verdicts_check_key_idx` ON `compliance_verdicts` (`check_key`);--> statement-breakpoint
CREATE INDEX `content_campaigns_organization_id_idx` ON `content_campaigns` (`organization_id`);--> statement-breakpoint
CREATE INDEX `content_campaigns_user_id_idx` ON `content_campaigns` (`user_id`);--> statement-breakpoint
CREATE INDEX `content_ops_pipelines_organization_id_idx` ON `content_ops_pipelines` (`organization_id`);--> statement-breakpoint
CREATE INDEX `content_ops_pipelines_user_id_idx` ON `content_ops_pipelines` (`user_id`);--> statement-breakpoint
CREATE INDEX `content_ops_pipelines_script_id_idx` ON `content_ops_pipelines` (`script_id`);--> statement-breakpoint
CREATE INDEX `content_ops_pipelines_stage_idx` ON `content_ops_pipelines` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `credential_refs_organization_id_idx` ON `credential_refs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `credential_refs_provider_idx` ON `credential_refs` (`provider`);--> statement-breakpoint
CREATE INDEX `dead_letter_jobs_organization_id_idx` ON `dead_letter_jobs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `dead_letter_jobs_status_idx` ON `dead_letter_jobs` (`dead_letter_status`);--> statement-breakpoint
CREATE INDEX `dead_letter_jobs_queue_name_idx` ON `dead_letter_jobs` (`queue_name`);--> statement-breakpoint
CREATE INDEX `dead_letter_jobs_created_at_idx` ON `dead_letter_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_snapshots_organization_id_idx` ON `evidence_snapshots` (`organization_id`);--> statement-breakpoint
CREATE INDEX `evidence_snapshots_claim_id_idx` ON `evidence_snapshots` (`claim_id`);--> statement-breakpoint
CREATE INDEX `evidence_snapshots_created_at_idx` ON `evidence_snapshots` (`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_sources_organization_id_idx` ON `evidence_sources` (`organization_id`);--> statement-breakpoint
CREATE INDEX `evidence_sources_snapshot_id_idx` ON `evidence_sources` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `evidence_sources_source_url_idx` ON `evidence_sources` (`source_url`);--> statement-breakpoint
CREATE INDEX `generated_metadata_script_id_idx` ON `generated_metadata` (`script_id`);--> statement-breakpoint
CREATE INDEX `governance_policies_organization_id_idx` ON `governance_policies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idempotency_records_org_key_idx` ON `idempotency_records` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idempotency_records_key_unique_idx` ON `idempotency_records` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `knowledge_embeddings_organization_id_idx` ON `knowledge_embeddings` (`organization_id`);--> statement-breakpoint
CREATE INDEX `knowledge_embeddings_entity_idx` ON `knowledge_embeddings` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `knowledge_embeddings_backend_idx` ON `knowledge_embeddings` (`embedding_backend`);--> statement-breakpoint
CREATE INDEX `mcp_servers_organization_id_idx` ON `mcp_servers` (`organization_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_enabled_idx` ON `mcp_servers` (`enabled`);--> statement-breakpoint
CREATE INDEX `mfa_backup_codes_factor_id_idx` ON `mfa_backup_codes` (`factor_id`);--> statement-breakpoint
CREATE INDEX `mfa_backup_codes_used_at_idx` ON `mfa_backup_codes` (`used_at`);--> statement-breakpoint
CREATE INDEX `mfa_factors_user_id_idx` ON `mfa_factors` (`user_id`);--> statement-breakpoint
CREATE INDEX `mfa_factors_type_idx` ON `mfa_factors` (`mfa_type`);--> statement-breakpoint
CREATE INDEX `model_policies_organization_id_idx` ON `model_policies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `model_policies_policy_key_idx` ON `model_policies` (`policy_key`);--> statement-breakpoint
CREATE INDEX `org_budgets_organization_id_idx` ON `org_budgets` (`organization_id`);--> statement-breakpoint
CREATE INDEX `organization_members_org_id_idx` ON `organization_members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `organization_members_user_id_idx` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `organization_members_org_user_idx` ON `organization_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `organizations_slug_idx` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `prompt_definitions_organization_id_idx` ON `prompt_definitions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `prompt_versions_prompt_id_idx` ON `prompt_versions` (`prompt_id`);--> statement-breakpoint
CREATE INDEX `prompt_versions_organization_id_idx` ON `prompt_versions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `quota_ledger_organization_id_idx` ON `quota_ledger` (`organization_id`);--> statement-breakpoint
CREATE INDEX `quota_ledger_provider_created_idx` ON `quota_ledger` (`provider`,`created_at`);--> statement-breakpoint
CREATE INDEX `research_archive_organization_id_idx` ON `research_archive` (`organization_id`);--> statement-breakpoint
CREATE INDEX `research_archive_topic_idx` ON `research_archive` (`topic`);--> statement-breakpoint
CREATE INDEX `research_archive_source_idx` ON `research_archive` (`source`);--> statement-breakpoint
CREATE INDEX `role_permissions_role_perm_idx` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE INDEX `role_permissions_role_id_idx` ON `role_permissions` (`role_id`);--> statement-breakpoint
CREATE INDEX `roles_organization_id_idx` ON `roles` (`organization_id`);--> statement-breakpoint
CREATE INDEX `roles_slug_idx` ON `roles` (`role_slug`);--> statement-breakpoint
CREATE INDEX `script_sections_script_id_idx` ON `script_sections` (`script_id`);--> statement-breakpoint
CREATE INDEX `scripts_organization_id_idx` ON `scripts` (`organization_id`);--> statement-breakpoint
CREATE INDEX `scripts_user_id_idx` ON `scripts` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_events_organization_id_idx` ON `security_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `security_events_severity_idx` ON `security_events` (`security_severity`);--> statement-breakpoint
CREATE INDEX `security_events_kind_idx` ON `security_events` (`kind`);--> statement-breakpoint
CREATE INDEX `security_events_created_at_idx` ON `security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_organization_id_idx` ON `sessions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `tool_definitions_organization_id_idx` ON `tool_definitions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_definitions_name_idx` ON `tool_definitions` (`name`);--> statement-breakpoint
CREATE INDEX `tool_definitions_source_idx` ON `tool_definitions` (`tool_source`);--> statement-breakpoint
CREATE INDEX `tool_definitions_mcp_server_id_idx` ON `tool_definitions` (`mcp_server_id`);--> statement-breakpoint
CREATE INDEX `tool_gateway_policies_organization_id_idx` ON `tool_gateway_policies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_invocations_organization_id_idx` ON `tool_invocations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_invocations_tool_name_idx` ON `tool_invocations` (`tool_name`);--> statement-breakpoint
CREATE INDEX `tool_invocations_status_idx` ON `tool_invocations` (`tool_invocation_status`);--> statement-breakpoint
CREATE INDEX `tool_invocations_created_at_idx` ON `tool_invocations` (`created_at`);--> statement-breakpoint
CREATE INDEX `tool_policies_organization_id_idx` ON `tool_policies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `topic_taxonomies_organization_id_idx` ON `topic_taxonomies` (`organization_id`);--> statement-breakpoint
CREATE INDEX `topic_taxonomies_slug_idx` ON `topic_taxonomies` (`slug`);--> statement-breakpoint
CREATE INDEX `topic_taxonomies_parent_id_idx` ON `topic_taxonomies` (`parent_id`);--> statement-breakpoint
CREATE INDEX `user_credentials_user_id_idx` ON `user_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `vault_secrets_organization_id_idx` ON `vault_secrets` (`organization_id`);--> statement-breakpoint
CREATE INDEX `vault_secrets_provider_idx` ON `vault_secrets` (`vault_provider`);--> statement-breakpoint
CREATE INDEX `vault_secrets_path_idx` ON `vault_secrets` (`path`);--> statement-breakpoint
CREATE INDEX `vault_secrets_expires_at_idx` ON `vault_secrets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `webhooks_organization_id_idx` ON `webhooks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `webhooks_event_type_idx` ON `webhooks` (`event_type`);--> statement-breakpoint
CREATE INDEX `webhooks_created_at_idx` ON `webhooks` (`created_at`);--> statement-breakpoint
CREATE INDEX `winning_patterns_organization_id_idx` ON `winning_patterns` (`organization_id`);--> statement-breakpoint
CREATE INDEX `winning_patterns_content_type_idx` ON `winning_patterns` (`content_type`);--> statement-breakpoint
CREATE INDEX `winning_patterns_source_video_id_idx` ON `winning_patterns` (`source_video_id`);--> statement-breakpoint
CREATE INDEX `winning_patterns_source_script_id_idx` ON `winning_patterns` (`source_script_id`);--> statement-breakpoint
CREATE INDEX `workflow_definitions_organization_id_idx` ON `workflow_definitions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `workflow_definitions_status_idx` ON `workflow_definitions` (`workflow_status`);--> statement-breakpoint
CREATE INDEX `workflow_run_events_organization_id_idx` ON `workflow_run_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `workflow_run_events_run_id_idx` ON `workflow_run_events` (`workflow_run_id`);--> statement-breakpoint
CREATE INDEX `workflow_run_events_created_at_idx` ON `workflow_run_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `workflow_runs_organization_id_idx` ON `workflow_runs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `workflow_runs_workflow_id_idx` ON `workflow_runs` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `workflow_runs_status_idx` ON `workflow_runs` (`workflow_run_status`);--> statement-breakpoint
CREATE INDEX `workflow_runs_version_id_idx` ON `workflow_runs` (`workflow_version_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_organization_id_idx` ON `workflow_step_runs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_run_id_idx` ON `workflow_step_runs` (`workflow_run_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_status_idx` ON `workflow_step_runs` (`workflow_step_status`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_run_node_idx` ON `workflow_step_runs` (`workflow_run_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_runs_idempotency_key_idx` ON `workflow_step_runs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `workflow_versions_workflow_id_idx` ON `workflow_versions` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `workflow_versions_organization_id_idx` ON `workflow_versions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `workflow_versions_workflow_version_idx` ON `workflow_versions` (`workflow_id`,`version`);--> statement-breakpoint
CREATE INDEX `youtube_channels_organization_id_idx` ON `youtube_channels` (`organization_id`);--> statement-breakpoint
CREATE INDEX `youtube_channels_is_active_idx` ON `youtube_channels` (`is_active`);--> statement-breakpoint
CREATE INDEX `youtube_channels_youtube_channel_id_idx` ON `youtube_channels` (`youtube_channel_id`);--> statement-breakpoint
CREATE INDEX `youtube_trends_organization_id_idx` ON `youtube_trends` (`organization_id`);--> statement-breakpoint
CREATE INDEX `youtube_trends_query_idx` ON `youtube_trends` (`query`);--> statement-breakpoint
CREATE INDEX `youtube_trends_fetched_at_idx` ON `youtube_trends` (`fetched_at`);--> statement-breakpoint
CREATE INDEX `youtube_videos_organization_id_idx` ON `youtube_videos` (`organization_id`);--> statement-breakpoint
CREATE INDEX `youtube_videos_channel_id_idx` ON `youtube_videos` (`channel_id`);--> statement-breakpoint
CREATE INDEX `youtube_videos_status_idx` ON `youtube_videos` (`youtube_video_status`);--> statement-breakpoint
CREATE INDEX `youtube_videos_workflow_run_id_idx` ON `youtube_videos` (`workflow_run_id`);