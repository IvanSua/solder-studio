-- CRITICAL FIX: gift card purchases previously granted spendable balance
-- immediately on POST /api/v1/gift-cards/purchase with NO payment collection
-- at all — any authenticated user could mint up to $50,000 ARS of real,
-- redeemable store credit per request, for free, simply by calling the
-- endpoint (rate-limited only by the generic 300 req/min global limiter).
--
-- From here on, a purchased gift card starts INACTIVE ("awaiting payment")
-- and is only flipped to active (spendable) by the MercadoPago webhook once
-- the payment is actually approved — the same pattern already used for
-- regular orders (see PaymentWebhookService / CheckoutService).
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS payment_external_id VARCHAR(64);
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS checkout_url VARCHAR(2048);
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_idempotency_key
    ON gift_cards (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
