package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder @AllArgsConstructor
public class ProductQuestionsResponse {
    private Long productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private int totalQuestions;
    private int pendingQuestions;
    private int answeredQuestions;
}
