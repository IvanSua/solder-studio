package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CreatePromotionRequest;
import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.dto.response.PromotionResponse;
import com.tiendaropa.service.PromotionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/promotions")
@RequiredArgsConstructor
public class AdminPromotionController {

    private final PromotionService promotionService;

    @GetMapping
    public Page<PromotionResponse> listAll(Pageable pageable) {
        return promotionService.listAll(pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PromotionResponse create(@Valid @RequestBody CreatePromotionRequest request) {
        return promotionService.create(request);
    }

    @PutMapping("/{id}")
    public PromotionResponse update(@PathVariable Long id,
                                    @Valid @RequestBody CreatePromotionRequest request) {
        return promotionService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        promotionService.delete(id);
    }

    /** Preview: validate a coupon code against a given subtotal (in centavos) */
    @GetMapping("/validate")
    public CouponValidationResponse validate(@RequestParam String code,
                                             @RequestParam(defaultValue = "0") long subtotal) {
        return promotionService.validateCoupon(code, subtotal);
    }
}
