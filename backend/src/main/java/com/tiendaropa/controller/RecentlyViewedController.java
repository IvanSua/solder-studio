package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.service.RecentlyViewedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/recently-viewed")
@RequiredArgsConstructor
public class RecentlyViewedController {

    private final RecentlyViewedService recentlyViewedService;

    @PostMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@PathVariable Long productId, Authentication auth) {
        recentlyViewedService.recordView((Long) auth.getPrincipal(), productId);
    }

    @GetMapping
    public List<ProductResponse> getRecentlyViewed(
            Authentication auth,
            @RequestParam(required = false) Long excludeProductId) {
        return recentlyViewedService.getRecentlyViewed((Long) auth.getPrincipal(), excludeProductId);
    }
}
