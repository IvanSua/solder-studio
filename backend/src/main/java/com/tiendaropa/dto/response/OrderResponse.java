package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class OrderResponse {
    private Long orderId;
    private String status;
    private String customerEmail;
    private String customerName;
    private List<OrderItemResponse> items;
    private OrderAmounts amounts;
    private ShippingAddress shippingAddress;
    private String paymentMethod;
    private Integer installments;
    private String trackingNumber;
    private String trackingUrl;
    private Instant estimatedDeliveryAt;
    private String adminNotes;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @AllArgsConstructor
    public static class ShippingAddress {
        private String street;
        private String apartment;
        private String city;
        private String province;
        private String postalCode;
    }

    @Data
    @Builder
    @AllArgsConstructor
    public static class OrderItemResponse {
        private Long productVariantId;
        private String productName;
        private String productSlug;
        private String imageUrl;
        private String color;
        private String size;
        private Integer quantity;
        private Long unitPrice;
        private Long customDesignId;
    }

    @Data
    @Builder
    @AllArgsConstructor
    public static class OrderAmounts {
        private Long subtotal;
        private Long discount;
        private Long tax;
        private Long shipping;
        private Long total;
        private String currency;
    }
}
