-- ── Migración V002: Tabla de eventos ─────────────────────────────────────────
-- ARCHIVO MOVIDO: La fuente de verdad es backend/migrations/V002__events_table.sql
-- Este archivo se mantiene únicamente por compatibilidad con el classpath.
-- Ejecutar UNA sola vez contra la base de datos existente.
-- Para bases de datos nuevas esto ya está incluido en schema.sql.

CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    subtitle    VARCHAR(300),
    type        VARCHAR(20)  NOT NULL DEFAULT 'CONCERT',
    category    VARCHAR(40),
    event_date  DATE         NOT NULL,
    event_time  TIME,
    venue       VARCHAR(200),
    city        VARCHAR(100) DEFAULT 'Buenos Aires',
    description TEXT,
    image_url   VARCHAR(500),
    ticket_url  VARCHAR(500),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date   ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);
