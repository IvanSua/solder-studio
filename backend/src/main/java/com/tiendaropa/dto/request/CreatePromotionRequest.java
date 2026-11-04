package com.tiendaropa.dto.request;

import com.tiendaropa.enums.PromotionScope;
import com.tiendaropa.enums.PromotionType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class CreatePromotionRequest {

    @NotBlank
    private String name;

    /** Optional coupon code for manual redemption. Case-insensitive. */
    private String code;

    private String description;

    @NotNull
    private PromotionScope scope;

    @NotNull
    private PromotionType type;

    /** Percentage: e.g. 1500 = 15.00%; Fixed: centavos */
    @NotNull
    @Min(1)
    private Long value;

    private int priority = 0;

    private boolean stackable = false;

    private Long targetProductId;
    private Long targetCategoryId;

    private Long minimumPurchaseAmount;

    @NotNull
    private Instant startsAt;

    @NotNull
    private Instant endsAt;

    private boolean active = true;
}
