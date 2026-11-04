package com.tiendaropa.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CartItemRequest {

    @NotNull
    private Long productVariantId;

    @NotNull @Min(1)
    private Integer quantity;

    private Long customDesignId;
}
