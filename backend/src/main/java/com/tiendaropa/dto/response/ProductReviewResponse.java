package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
public class ProductReviewResponse {
    private Long id;
    private Long productId;
    private String productSlug;
    private Long userId;
    private String authorName;
    private Short rating;
    private String title;
    private String body;
    private Boolean verifiedPurchase;
    private String status;
    private Instant createdAt;
}
