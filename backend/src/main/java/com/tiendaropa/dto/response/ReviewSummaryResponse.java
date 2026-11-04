package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data @Builder @AllArgsConstructor
public class ReviewSummaryResponse {
    private Double averageRating;
    private Long totalReviews;
    private Map<Integer, Long> ratingDistribution;
    private List<ReviewResponse> reviews;
    private Boolean userHasReviewed;
}
