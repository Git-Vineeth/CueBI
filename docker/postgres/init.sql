-- =============================================================================
-- CueBI App Schema — internal tables for the platform itself
-- This is NOT the user's data — this stores connections, queries, metadata.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free',
    llm_provider VARCHAR(20) DEFAULT 'openai',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    org_id UUID REFERENCES organizations(id),
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data source connections (credentials encrypted before storage)
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    conn_type VARCHAR(30) NOT NULL,  -- postgresql, mysql, redshift, rds_postgresql, rds_mysql
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(100),
    username VARCHAR(100),
    password_enc TEXT,  -- encrypted
    extra_config JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',  -- pending, syncing, ready, error
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Schema metadata (introspected + dbt-enriched per column)
CREATE TABLE IF NOT EXISTS schema_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100),
    data_type VARCHAR(50),
    description TEXT,
    is_primary_key BOOLEAN DEFAULT FALSE,
    foreign_key VARCHAR(200),
    vector_id VARCHAR(100),
    -- dbt semantic layer fields
    dbt_model_schema VARCHAR(100),          -- Redshift schema (e.g. "analytics")
    lineage JSONB DEFAULT '[]',             -- parent model names ["stg_students", ...]
    source VARCHAR(20) DEFAULT 'introspection', -- 'introspection' | 'dbt'
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT schema_metadata_unique UNIQUE (connection_id, table_name, column_name)
);

-- dbt integration config per connection
CREATE TABLE IF NOT EXISTS dbt_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE UNIQUE,
    dbt_type VARCHAR(20) NOT NULL DEFAULT 'manifest', -- 'manifest' | 'cloud'
    -- dbt Cloud fields (encrypted in production)
    account_id VARCHAR(200),
    project_id VARCHAR(200),
    environment_id VARCHAR(200),
    api_token_enc TEXT,
    -- Sync state
    sync_status VARCHAR(20) DEFAULT 'pending',  -- pending | syncing | ready | error
    sync_error TEXT,
    model_count INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Query history
CREATE TABLE IF NOT EXISTS queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    connection_id UUID REFERENCES connections(id),
    question TEXT NOT NULL,
    generated_sql TEXT,
    result_row_count INTEGER,
    duration_ms INTEGER,
    llm_provider VARCHAR(20),
    llm_model VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, success, error
    error_message TEXT,
    chart_type VARCHAR(30),
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Saved / pinned questions
CREATE TABLE IF NOT EXISTS saved_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    query_id UUID REFERENCES queries(id),
    name VARCHAR(200),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    query_id UUID REFERENCES queries(id),
    connection_id UUID REFERENCES connections(id),
    cron_expression VARCHAR(100) NOT NULL,
    recipients TEXT[],
    format VARCHAR(20) DEFAULT 'csv',
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    query_id UUID REFERENCES queries(id),
    connection_id UUID REFERENCES connections(id),
    condition VARCHAR(20) NOT NULL,  -- gt, lt, eq
    threshold NUMERIC NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    check_interval_minutes INTEGER DEFAULT 60,
    notify_emails TEXT[],
    notify_webhook TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Team invites
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'analyst',
    status VARCHAR(20) DEFAULT 'pending',
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMP DEFAULT NOW()
);

-- API keys (user-provided OpenAI / Anthropic keys, encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    provider VARCHAR(20) NOT NULL,
    key_enc TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed a default org and user for local dev
INSERT INTO organizations (id, name, plan) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Dev Organization', 'pro')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, name, org_id, role) VALUES
    ('00000000-0000-0000-0000-000000000002', 'dev@cuemath.com', 'Dev User', '00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT DO NOTHING;