CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id                  BIGSERIAL PRIMARY KEY,
    payment_external_id VARCHAR(255) NOT NULL UNIQUE,
    status              VARCHAR(30)  NOT NULL,
    order_id            BIGINT,
    received_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ,
    payload_hash        VARCHAR(64),
    retry_count         INT          NOT NULL DEFAULT 0,
    last_error          VARCHAR(500),
    next_retry_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_external_id ON payment_webhook_events(payment_external_id);

ALTER TABLE payment_webhook_events
    ADD COLUMN IF NOT EXISTS last_error VARCHAR(500);
