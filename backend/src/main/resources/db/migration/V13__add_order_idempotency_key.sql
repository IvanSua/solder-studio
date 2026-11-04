-- Idempotency support for checkout: the frontend generates a UUID once per
-- checkout attempt and resends the SAME key on every retry (network timeout,
-- double click, page reload after a lost response, etc.). The unique partial
-- index below is the hard guarantee — even if two requests with the same key
-- somehow reach the app at the exact same time, only one INSERT can succeed;
-- the other fails with a constraint violation and the app returns the order
-- that won instead of creating a second one.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_checkout_url VARCHAR(2048);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
    ON orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
