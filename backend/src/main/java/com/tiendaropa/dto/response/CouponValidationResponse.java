package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CouponValidationResponse {
    private boolean valid;
    private String message;
    /** Discount in centavos (0 if invalid) */
    private long discountAmount;
    private String promotionName;
}
