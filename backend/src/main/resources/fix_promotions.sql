-- Fix / ensure the promotions table exists with the correct schema.
-- Run this ONCE in pgAdmin if GET /api/admin/promotions or POST return 500.
-- Safe to run on a fresh DB; CREATE TABLE IF NOT EXISTS is idempotent.
SET client_encoding = 'UTF8';

BEGIN;

CREATE TABLE IF NOT EXISTS promotions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    scope VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    value BIGINT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    stackable BOOLEAN NOT NULL DEFAULT FALSE,
    exclusive_group VARCHAR(100),
    target_product_id BIGINT,
    target_category_id BIGINT,
    minimum_purchase_amount BIGINT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, starts_at, ends_at);

COMMIT;

-- Verify
SELECT COUNT(*) AS total_promotions FROM promotions;
