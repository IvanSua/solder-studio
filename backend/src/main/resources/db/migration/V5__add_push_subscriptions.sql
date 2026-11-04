-- Web Push subscriptions — stores each browser/device subscription
-- that a user opted into for push notifications.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint      TEXT         NOT NULL,
    p256dh        TEXT         NOT NULL,   -- DH public key (Base64url)
    auth          TEXT         NOT NULL,   -- Auth secret (Base64url)
    user_agent    VARCHAR(500),            -- Browser/OS for display only
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,

    -- One endpoint maps to exactly one subscription record
    CONSTRAINT uq_push_endpoint UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
