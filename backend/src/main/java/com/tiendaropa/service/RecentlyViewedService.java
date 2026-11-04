package com.tiendaropa.service;

import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.entity.RecentlyViewed;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.RecentlyViewedRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecentlyViewedService {

    private final RecentlyViewedRepository recentlyViewedRepo;
    private final ProductService productService;

    private static final int MAX_RECENTLY_VIEWED = 20;

    @Transactional
    public void recordView(Long userId, Long productId) {
        Optional<RecentlyViewed> existing = recentlyViewedRepo.findByUserIdAndProductId(userId, productId);
        if (existing.isPresent()) {
            RecentlyViewed rv = existing.get();
            rv.setViewedAt(Instant.now());
            recentlyViewedRepo.save(rv);
        } else {
            recentlyViewedRepo.save(RecentlyViewed.builder()
                    .userId(userId)
                    .productId(productId)
                    .viewedAt(Instant.now())
                    .build());
            long count = recentlyViewedRepo.countByUserId(userId);
            if (count > MAX_RECENTLY_VIEWED) {
                recentlyViewedRepo.deleteOldestForUser(userId, count - MAX_RECENTLY_VIEWED);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> getRecentlyViewed(Long userId, Long excludeProductId) {
        Pageable limit = PageRequest.of(0, 10);
        List<RecentlyViewed> recent = excludeProductId != null
                ? recentlyViewedRepo.findRecentByUserIdExcluding(userId, excludeProductId, limit)
                : recentlyViewedRepo.findRecentByUserId(userId, limit);
        return recent.stream()
                .map(rv -> {
                    try {
                        return productService.getProduct(rv.getProductId());
                    } catch (ResourceNotFoundException e) {
                        return null;
                    }
                })
                .filter(p -> p != null)
                .collect(Collectors.toList());
    }
}
