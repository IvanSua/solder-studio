package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CreateReviewRequest;
import com.tiendaropa.dto.response.ReviewResponse;
import com.tiendaropa.dto.response.ReviewSummaryResponse;
import com.tiendaropa.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/products/{slug}/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /** Get all reviews + summary for a product */
    @GetMapping
    public ReviewSummaryResponse getReviews(@PathVariable String slug,
                                             Authentication auth) {
        Long userId = auth != null ? (Long) auth.getPrincipal() : null;
        return reviewService.getReviews(slug, userId);
    }

    /** Submit a review (authenticated users only) */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse createReview(@PathVariable String slug,
                                       @RequestBody @Valid CreateReviewRequest req,
                                       Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return reviewService.createReview(slug, userId, req);
    }
}
