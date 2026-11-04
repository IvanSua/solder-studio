-- users: account lockout tracking
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;

-- orders: gift card discount columns
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS gift_card_code             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gift_card_discount_amount  BIGINT NOT NULL DEFAULT 0;

-- product_reviews: moderation status
ALTER TABLE product_reviews
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- return_requests: refund tracking
ALTER TABLE return_requests
    ADD COLUMN IF NOT EXISTS refund_amount    BIGINT,
    ADD COLUMN IF NOT EXISTS refund_processed BOOLEAN NOT NULL DEFAULT FALSE;
