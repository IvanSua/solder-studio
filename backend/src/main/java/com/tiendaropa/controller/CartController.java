package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CartItemRequest;
import com.tiendaropa.dto.response.CartResponse;
import com.tiendaropa.service.CartService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public CartResponse getCart(Authentication auth) {
        return cartService.getCart(getUserId(auth));
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public CartResponse addItem(Authentication auth, @Valid @RequestBody CartItemRequest request) {
        return cartService.addItem(getUserId(auth), request);
    }

    @PatchMapping("/items/{itemId}")
    public CartResponse updateQuantity(
            Authentication auth,
            @PathVariable Long itemId,
            @Valid @RequestBody UpdateQuantityRequest request) {
        return cartService.updateQuantity(getUserId(auth), itemId, request.getQuantity());
    }

    @DeleteMapping("/items/{itemId}")
    public CartResponse removeItem(Authentication auth, @PathVariable Long itemId) {
        return cartService.removeItem(getUserId(auth), itemId);
    }

    @Data
    public static class UpdateQuantityRequest {
        @Min(0)
        private int quantity;
    }

    private Long getUserId(Authentication auth) {
        return (Long) auth.getPrincipal();
    }
}
