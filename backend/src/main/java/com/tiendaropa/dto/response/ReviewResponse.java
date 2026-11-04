package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder @AllArgsConstructor
public class ReviewResponse {
    private Long id;
    private Short rating;
    private String title;
    private String body;
    private String authorName;
    private Boolean verifiedPurchase;
    private Instant createdAt;
}
