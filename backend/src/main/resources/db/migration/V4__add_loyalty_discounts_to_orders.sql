-- Loyalty discount columns on orders.
-- tier_discount: automatic discount from GOLD (5%) / PLATINUM (10%) membership.
-- points_discount: discount from points redeemed by the buyer.
-- points_redeemed: number of points spent (points_discount / 100 centavos per point).

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS loyalty_tier_discount_amount   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_points_discount_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_points_redeemed        INT    NOT NULL DEFAULT 0;
