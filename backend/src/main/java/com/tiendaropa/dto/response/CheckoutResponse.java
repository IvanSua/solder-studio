package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
public class CheckoutResponse {
    private Long orderId;
    private Instant reservationExpiresAt;
    private PaymentSession paymentSession;
    private OrderAmounts amounts;
    private String couponApplied;
    private String giftCardApplied;
    private Long giftCardDiscount;
    /** Loyalty tier name applied (null if BRONZE/SILVER) */
    private String loyaltyTierApplied;
    /** Points redeemed in this order (0 if none) */
    private Integer loyaltyPointsRedeemed;

    @Data
    @Builder
    @AllArgsConstructor
    public static class PaymentSession {
        private String provider;
        private String checkoutUrl;
    }

    @Data
    @Builder
    @AllArgsConstructor
    public static class OrderAmounts {
        private Long subtotal;
        private Long discount;
        private Long giftCardDiscount;
        /** Automatic tier discount (GOLD 5% / PLATINUM 10%) in centavos */
        private Long tierDiscount;
        /** Tier discount percentage (0, 5 or 10) */
        private Integer tierDiscountPercent;
        /** Discount from loyalty points redeemed, in centavos */
        private Long pointsDiscount;
        /** Number of loyalty points spent */
        private Integer pointsRedeemed;
        private Long tax;
        private Long shipping;
        private Long total;
        private String currency;
    }
}
