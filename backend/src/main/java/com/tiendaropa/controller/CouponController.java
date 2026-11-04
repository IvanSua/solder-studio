package com.tiendaropa.controller;

import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.service.PromotionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Customer-facing coupon validation endpoint.
 * Allows the checkout page to preview the discount before submitting.
 */
@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final PromotionService promotionService;

    @GetMapping("/validate")
    public CouponValidationResponse validate(@RequestParam String code,
                                             @RequestParam(defaultValue = "0") long subtotal) {
        return promotionService.validateCoupon(code, subtotal);
    }
}
