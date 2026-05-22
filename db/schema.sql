-- ============================================================
--  Meridian Investor Platform – PostgreSQL Schema
--  Target: PostgreSQL 15+
--
--  Idempotent: safe to run multiple times (IF NOT EXISTS / OR REPLACE).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ──────────────────────────────────────────────
--  ENUM: lifecycle states for an investor account
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_status') THEN
    CREATE TYPE investor_status AS ENUM (
      'pending_kyc',
      'active',
      'suspended',
      'closed'
    );
  END IF;
END
$$;

-- ──────────────────────────────────────────────
--  TABLE: investors
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investors (
  id             UUID            NOT NULL DEFAULT gen_random_uuid(),
  full_name      VARCHAR(200)    NOT NULL,
  -- Stored lowercase; the application layer normalises before insert.
  -- The functional unique index below enforces case-insensitive uniqueness
  -- at the database level as a defence-in-depth measure.
  email          VARCHAR(254)    NOT NULL,
  date_of_birth  DATE            NOT NULL,
  country        CHAR(2)         NOT NULL,   -- ISO 3166-1 alpha-2, uppercase
  status         investor_status NOT NULL DEFAULT 'pending_kyc',
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- ── Primary key ───────────────────────────────────────────
  CONSTRAINT investors_pkey PRIMARY KEY (id),

  -- ── 18+ age check (re-evaluated on every UPDATE as well) ──
  CONSTRAINT investors_dob_18plus CHECK (
    date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')
  ),

  -- ── Country must be exactly 2 uppercase ASCII letters ─────
  CONSTRAINT investors_country_format CHECK (
    country ~ '^[A-Z]{2}$'
  ),

  -- ── Email must contain exactly one '@' and a dot after it ─
  -- (The application layer runs full RFC-5321 validation via Zod;
  --  this constraint is a last-resort DB-level sanity check.)
  CONSTRAINT investors_email_format CHECK (
    email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),

  -- ── Email must be stored in lowercase ─────────────────────
  CONSTRAINT investors_email_lowercase CHECK (
    email = LOWER(email)
  )
);

-- ──────────────────────────────────────────────
--  INDEXES
-- ──────────────────────────────────────────────

-- Case-insensitive unique email lookups (duplicate detection + login).
-- This is the canonical uniqueness enforcement; the functional expression
-- guarantees that two addresses differing only in case cannot coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_investors_email_lower
  ON investors (LOWER(email));

-- Primary-key lookups are covered automatically by the PK index, but
-- we add an explicit UUID index as a reminder it is the GET /:id path.
-- (Postgres creates a btree index on the PK automatically; this comment
--  documents the expected query plan for the GET /investors/:id route.)

-- Fast range scans on registration timeline (dashboard, reporting).
CREATE INDEX IF NOT EXISTS idx_investors_created_at
  ON investors (created_at DESC);

-- KYC workflow queue: filter-by-status queries.
CREATE INDEX IF NOT EXISTS idx_investors_status
  ON investors (status)
  WHERE status = 'pending_kyc';   -- partial index – only pending rows

-- Jurisdiction analytics.
CREATE INDEX IF NOT EXISTS idx_investors_country
  ON investors (country);

-- ──────────────────────────────────────────────
--  FUNCTION & TRIGGER: auto-update updated_at
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investors_set_updated_at ON investors;
CREATE TRIGGER investors_set_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
