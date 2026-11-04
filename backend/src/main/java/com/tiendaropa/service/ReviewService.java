package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreateReviewRequest;
import com.tiendaropa.dto.response.ProductReviewResponse;
import com.tiendaropa.dto.response.ReviewResponse;
import com.tiendaropa.dto.response.ReviewSummaryResponse;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductReview;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.ReviewStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.ProductReviewRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ProductReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public ReviewSummaryResponse getReviews(String productSlug, Long currentUserId) {
        Product product = productRepository.findBySlug(productSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productSlug));

        List<ProductReview> all = reviewRepository
                .findByProductIdOrderByCreatedAtDesc(product.getId(), PageRequest.of(0, 50))
                .getContent();

        Double avg = reviewRepository.findAverageRatingByProductId(product.getId());
        Long total = reviewRepository.countByProductId(product.getId());

        // Rating distribution 1-5
        Map<Integer, Long> dist = new LinkedHashMap<>();
        for (int i = 5; i >= 1; i--) {
            final int rating = i;
            dist.put(rating, all.stream().filter(r -> r.getRating() == rating).count());
        }

        boolean hasReviewed = currentUserId != null &&
                reviewRepository.existsByProductIdAndUserId(product.getId(), currentUserId);

        List<ReviewResponse> reviews = all.stream().map(this::mapReview).toList();

        return ReviewSummaryResponse.builder()
                .averageRating(avg != null ? Math.round(avg * 10.0) / 10.0 : null)
                .totalReviews(total)
                .ratingDistribution(dist)
                .reviews(reviews)
                .userHasReviewed(hasReviewed)
                .build();
    }

    @Transactional
    public ReviewResponse createReview(String productSlug, Long userId, CreateReviewRequest req) {
        Product product = productRepository.findBySlug(productSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productSlug));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (reviewRepository.existsByProductIdAndUserId(product.getId(), userId)) {
            throw new BusinessException("Ya dejaste una reseña para este producto", HttpStatus.CONFLICT);
        }

        // Check if user has a delivered order containing this product
        boolean verified = orderRepository.existsDeliveredOrderForUserAndProduct(userId, product.getId());

        ProductReview review = ProductReview.builder()
                .product(product)
                .user(user)
                .rating(req.getRating())
                .title(req.getTitle())
                .body(req.getBody())
                .verifiedPurchase(verified)
                .build();

        return mapReview(reviewRepository.save(review));
    }

    // ── Admin moderation ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ProductReviewResponse> getReviewsByStatus(ReviewStatus status, Pageable pageable) {
        return reviewRepository.findByStatus(status, pageable).map(this::mapToAdminResponse);
    }

    @Transactional
    public ProductReviewResponse approveReview(Long reviewId) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        if (review.getStatus() != ReviewStatus.PENDING) {
            throw new BusinessException("La reseña ya fue procesada", HttpStatus.CONFLICT);
        }
        review.setStatus(ReviewStatus.APPROVED);
        return mapToAdminResponse(reviewRepository.save(review));
    }

    @Transactional
    public ProductReviewResponse rejectReview(Long reviewId) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        if (review.getStatus() != ReviewStatus.PENDING) {
            throw new BusinessException("La reseña ya fue procesada", HttpStatus.CONFLICT);
        }
        review.setStatus(ReviewStatus.REJECTED);
        return mapToAdminResponse(reviewRepository.save(review));
    }

    private ProductReviewResponse mapToAdminResponse(ProductReview r) {
        String name = r.getUser() != null
                ? r.getUser().getFirstName() + " " + r.getUser().getLastName().charAt(0) + "."
                : "Anónimo";
        return ProductReviewResponse.builder()
                .id(r.getId())
                .productId(r.getProduct().getId())
                .productSlug(r.getProduct().getSlug())
                .userId(r.getUser() != null ? r.getUser().getId() : null)
                .authorName(name)
                .rating(r.getRating())
                .title(r.getTitle())
                .body(r.getBody())
                .verifiedPurchase(r.getVerifiedPurchase())
                .status(r.getStatus().name())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private ReviewResponse mapReview(ProductReview r) {
        String name = r.getUser() != null
                ? r.getUser().getFirstName() + " " + r.getUser().getLastName().charAt(0) + "."
                : "Anónimo";
        return ReviewResponse.builder()
                .id(r.getId())
                .rating(r.getRating())
                .title(r.getTitle())
                .body(r.getBody())
                .authorName(name)
                .verifiedPurchase(r.getVerifiedPurchase())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
