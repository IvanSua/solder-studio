package com.tiendaropa.dto.response;

import com.tiendaropa.enums.PromotionScope;
import com.tiendaropa.enums.PromotionType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class PromotionResponse {
    private Long id;
    private String name;
    private String code;
    private String description;
    private PromotionScope scope;
    private PromotionType type;
    private Long value;
    private int priority;
    private boolean stackable;
    private Long targetProductId;
    private Long targetCategoryId;
    private Long minimumPurchaseAmount;
    private Instant startsAt;
    private Instant endsAt;
    private boolean active;
    private Instant createdAt;
}
