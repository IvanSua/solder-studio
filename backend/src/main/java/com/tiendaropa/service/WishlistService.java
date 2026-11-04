package com.tiendaropa.service;

import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.entity.WishlistItem;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.WishlistItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WishlistService {

    private final WishlistItemRepository wishlistRepo;
    private final ProductRepository productRepo;
    private final ProductService productService;

    @Transactional(readOnly = true)
    public List<ProductResponse> getWishlist(Long userId) {
        return wishlistRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(item -> {
                    try {
                        return productService.getProduct(item.getProductId());
                    } catch (ResourceNotFoundException e) {
                        return null;
                    }
                })
                .filter(p -> p != null)
                .collect(Collectors.toList());
    }

    @Transactional
    public boolean toggle(Long userId, Long productId) {
        if (!productRepo.existsById(productId)) {
            throw new ResourceNotFoundException("Product not found: " + productId);
        }
        Optional<WishlistItem> existing = wishlistRepo.findByUserIdAndProductId(userId, productId);
        if (existing.isPresent()) {
            wishlistRepo.delete(existing.get());
            return false;
        } else {
            wishlistRepo.save(WishlistItem.builder().userId(userId).productId(productId).build());
            return true;
        }
    }

    @Transactional(readOnly = true)
    public boolean isWishlisted(Long userId, Long productId) {
        return wishlistRepo.existsByUserIdAndProductId(userId, productId);
    }

    @Transactional(readOnly = true)
    public Set<Long> getWishlistedProductIds(Long userId) {
        return wishlistRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(WishlistItem::getProductId)
                .collect(Collectors.toSet());
    }
}
