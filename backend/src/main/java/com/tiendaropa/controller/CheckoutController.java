package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CheckoutRequest;
import com.tiendaropa.dto.request.GuestCheckoutRequest;
import com.tiendaropa.dto.response.CheckoutResponse;
import com.tiendaropa.dto.response.LoyaltyCheckoutPreviewResponse;
import com.tiendaropa.service.CheckoutService;
import com.tiendaropa.service.GuestCheckoutService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/checkout")
@RequiredArgsConstructor
@Validated
public class CheckoutController {

    private final CheckoutService checkoutService;
    private final GuestCheckoutService guestCheckoutService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CheckoutResponse checkout(Authentication auth, @Valid @RequestBody CheckoutRequest request) {
        return checkoutService.checkout((Long) auth.getPrincipal(), request);
    }

    /**
     * Checkout sin cuenta. Público (ver SecurityConfig) — la validación de que
     * el email no pertenezca a una cuenta ya registrada vive en
     * {@link GuestCheckoutService}.
     */
    @PostMapping("/guest")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckoutResponse checkoutAsGuest(@Valid @RequestBody GuestCheckoutRequest request) {
        return guestCheckoutService.checkoutAsGuest(request);
    }

    /**
     * Returns the loyalty discounts that would apply for a given subtotal.
     * No order is created — safe to call repeatedly as the user adjusts options.
     *
     * @param subtotal       cart subtotal in centavos (after coupons, before loyalty)
     * @param pointsToRedeem how many points the user wants to redeem (default 0)
     */
    @GetMapping("/loyalty-preview")
    public LoyaltyCheckoutPreviewResponse loyaltyPreview(
            Authentication auth,
            @RequestParam @Min(0) long subtotal,
            @RequestParam(required = false, defaultValue = "0") @Min(0) int pointsToRedeem) {
        return checkoutService.previewLoyaltyDiscount(
                (Long) auth.getPrincipal(), subtotal, pointsToRedeem);
    }
}
