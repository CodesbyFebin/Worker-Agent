-- ============================================================
-- Worker Agent Cloud — Schema Verification (RC1)
-- Run after baseline to verify all tables/enum exist.
-- ============================================================

\echo '=== Verifying schema ==='

DO $$
DECLARE
    t RECORD;
    missing INT := 0;
BEGIN
    -- Verify all required tables
    FOR t IN
        SELECT table_name FROM (
            VALUES
                ('organizations'), ('users'), ('members'),
                ('sessions'), ('accounts'), ('verifications'),
                ('agents'), ('agent_runs'),
                ('tasks'),
                ('pipelines'), ('pipeline_steps'), ('pipeline_runs'),
                ('campaigns'),
                ('connectors'), ('connector_assets'),
                ('knowledge_base'), ('artifacts'),
                ('plans'), ('subscriptions'), ('ledger_entries'),
                ('settings'), ('audit_logs'), ('system_logs'),
                ('api_keys'),
                ('workflows'), ('workflow_runs'),
                ('integrations'),
                ('chat_sessions'), ('chat_messages')
        ) AS v(table_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t.table_name
        ) THEN
            RAISE WARNING 'MISSING TABLE: %', t.table_name;
            missing := missing + 1;
        END IF;
    END LOOP;

    -- Verify all required enums
    FOR t IN
        SELECT enum_name FROM (
            VALUES
                ('agent_status'), ('pipeline_status'), ('pipeline_step_kind'),
                ('pipeline_step_status'), ('connector_kind'), ('connector_status'),
                ('role_name'), ('campaign_status'), ('artifact_kind'),
                ('log_level'), ('provider_name'), ('task_priority'), ('task_status')
        ) AS v(enum_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = t.enum_name
        ) THEN
            RAISE WARNING 'MISSING ENUM: %', t.enum_name;
            missing := missing + 1;
        END IF;
    END LOOP;

    -- Verify required extensions
    FOR t IN
        SELECT ext_name FROM (
            VALUES ('uuid-ossp'), ('pgcrypto'), ('hstore')
        ) AS v(ext_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = t.ext_name
        ) THEN
            RAISE WARNING 'MISSING EXTENSION: %', t.ext_name;
            missing := missing + 1;
        END IF;
    END LOOP;

    IF missing = 0 THEN
        RAISE NOTICE '=== All % objects verified ===', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
        RAISE NOTICE 'Schema OK';
    ELSE
        RAISE EXCEPTION '% schema objects missing!', missing;
    END IF;
END $$;

\echo '=== Verification complete ==='
