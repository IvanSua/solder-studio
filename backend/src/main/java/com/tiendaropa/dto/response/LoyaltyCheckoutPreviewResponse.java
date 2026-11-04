package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Snapshot of the loyalty discounts that would apply to a given checkout.
 * Returned by GET /api/v1/checkout/loyalty-preview so the frontend can show
 * a live breakdown before the user confirms the order.
 */
@Data
@Builder
@AllArgsConstructor
public class LoyaltyCheckoutPreviewResponse {

    /** User's current points balance */
    private Integer availablePoints;

    /** Current loyalty level name (BRONZE, SILVER, GOLD, PLATINUM) */
    private String level;

    /** Human-readable level label (Bronce, Plata, Oro, Platino) */
    private String levelLabel;

    /** Automatic discount percentage from tier (0, 5 or 10) */
    private Integer tierDiscountPercent;

    /** Tier discount in centavos for the given subtotal */
    private Long tierDiscountAmount;

    /**
     * Maximum number of points the user can redeem for this order
     * (limited by available points and order amount after other discounts).
     */
    private Integer maxRedeemablePoints;

    /** Discount in centavos if the user redeems pointsRequested points */
    private Long pointsDiscountAmount;

    /** Actual points that would be redeemed (may be less than requested) */
    private Integer pointsRedeemed;
}
