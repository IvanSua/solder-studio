package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class CartResponse {
    private Long cartId;
    private List<CartItemResponse> items;
    private Long totalAmount;
    private String currencyCode;

    @Data
    @Builder
    @AllArgsConstructor
    public static class CartItemResponse {
        private Long cartItemId;
        private Long productVariantId;
        private String productName;
        private String productSlug;
        private String imageUrl;
        private String color;
        private String size;
        private Integer quantity;
        private Long unitPrice;
        private String currencyCode;
        private Long customDesignId;
    }
}
