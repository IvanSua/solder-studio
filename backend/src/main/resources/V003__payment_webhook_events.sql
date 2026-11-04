-- ── Migración V003: Tabla de eventos de webhook de MercadoPago ─────────────────
-- ARCHIVO MOVIDO: La fuente de verdad es backend/migrations/V003__payment_webhook_events.sql
-- Este archivo se mantiene únicamente por compatibilidad con el classpath.
-- Para garantizar idempotencia en el procesamiento de webhooks.
-- Si MercadoPago reenvía el mismo webhook, el segundo se ignora.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id                      BIGSERIAL PRIMARY KEY,
    payment_external_id     VARCHAR(255) NOT NULL UNIQUE,
    status                  VARCHAR(30)  NOT NULL,
    order_id                BIGINT REFERENCES orders(id),
    received_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at            TIMESTAMPTZ,
    payload_hash            VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_payment_external_id ON payment_webhook_events(payment_external_id);
