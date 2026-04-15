-- =============================================================================
-- Migration 03 — Auth + Team Isolation
-- Adds Google SSO fields, teams table, per-team schema access control.
-- Run once after 01-init.sql and 02-migration-reports-alerts.sql
-- =============================================================================

-- ── Extend users table ────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id     VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
    ADD COLUMN IF NOT EXISTS status        VARCHAR(20) DEFAULT 'active',  -- invited | active | disabled
    ADD COLUMN IF NOT EXISTS team_id       UUID;  -- FK added after teams table

-- ── Teams (one per business unit: Finance, Marketing, Ops, etc.) ─────────────
CREATE TABLE IF NOT EXISTS teams (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- FK from users.team_id → teams.id (added here so teams exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_team_id_fkey'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ── Per-team schema access (which tables each team can query) ────────────────
CREATE TABLE IF NOT EXISTS team_schema_access (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    table_name  VARCHAR(200) NOT NULL,    -- raw table name as stored in Qdrant payload, e.g. "dim_students"
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (team_id, table_name)
);

-- ── Per-team example questions (shown on home/empty state) ──────────────────
CREATE TABLE IF NOT EXISTS team_example_questions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Add team_id to queries and saved_questions ───────────────────────────────
ALTER TABLE queries
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE saved_questions
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- ── Seed: update dev user status ─────────────────────────────────────────────
UPDATE users SET status = 'active' WHERE email = 'dev@cuemath.com';
