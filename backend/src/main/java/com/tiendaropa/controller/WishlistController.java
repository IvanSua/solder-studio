package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping
    public List<ProductResponse> getWishlist(Authentication auth) {
        return wishlistService.getWishlist((Long) auth.getPrincipal());
    }

    @PostMapping("/{productId}/toggle")
    public Map<String, Object> toggle(@PathVariable Long productId, Authentication auth) {
        boolean added = wishlistService.toggle((Long) auth.getPrincipal(), productId);
        return Map.of("wishlisted", added);
    }

    @GetMapping("/ids")
    public Set<Long> getWishlistedIds(Authentication auth) {
        return wishlistService.getWishlistedProductIds((Long) auth.getPrincipal());
    }
}
