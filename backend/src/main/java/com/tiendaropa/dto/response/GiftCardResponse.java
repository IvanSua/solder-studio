package com.tiendaropa.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GiftCardResponse {

    private Long id;
    private String code;
    private BigDecimal initialAmount;
    private BigDecimal remainingAmount;
    private String currencyCode;
    private Long purchasedByUserId;
    private Long redeemedByUserId;
    private Instant expiresAt;
    private boolean active;
    private boolean expired;
    private boolean usable;
    private Instant createdAt;
    private Instant redeemedAt;

    /**
     * Set only right after a purchase when payment is still pending — the
     * frontend must redirect the user here to actually pay. Null once the
     * card is active/paid, or when fetched later via getMyCards/validate.
     */
    private String checkoutUrl;
}
