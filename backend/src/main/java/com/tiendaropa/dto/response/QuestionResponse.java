package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder @AllArgsConstructor
public class QuestionResponse {
    private Long id;
    private String question;
    private String answer;
    private String authorName;
    private String answeredByName;
    private Instant createdAt;
    private Instant answeredAt;
    
    // Info del producto
    private Long productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
}
