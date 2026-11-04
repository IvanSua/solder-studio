package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ProductReviewResponse;
import com.tiendaropa.enums.ReviewStatus;
import com.tiendaropa.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/reviews")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {

    private final ReviewService reviewService;

    @GetMapping
    public Page<ProductReviewResponse> list(
            @RequestParam(defaultValue = "PENDING") String status,
            Pageable pageable) {
        ReviewStatus reviewStatus = ReviewStatus.valueOf(status.toUpperCase());
        return reviewService.getReviewsByStatus(reviewStatus, pageable);
    }

    @PatchMapping("/{id}/approve")
    public ProductReviewResponse approve(@PathVariable Long id) {
        return reviewService.approveReview(id);
    }

    @PatchMapping("/{id}/reject")
    public ProductReviewResponse reject(@PathVariable Long id) {
        return reviewService.rejectReview(id);
    }
}
