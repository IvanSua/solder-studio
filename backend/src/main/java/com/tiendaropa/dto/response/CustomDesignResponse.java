package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
public class CustomDesignResponse {
    private Long designId;
    private String status;
    private String previewUrl;
    private String productionRenderUrl;

    // Variant info
    private Long variantId;
    private String variantColor;
    private String variantSize;

    // Product info
    private Long productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;
}
