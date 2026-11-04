package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.service.HybridShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/shipping")
@RequiredArgsConstructor
public class ShippingController {

    private final HybridShippingService hybridShippingService;

    @GetMapping("/calculate")
    public ResponseEntity<List<ShippingOptionResponse>> calculate(
            @RequestParam String province,
            @RequestParam(required = false) String postalCode,
            @RequestParam(required = false) Long orderAmount) {
        return ResponseEntity.ok(hybridShippingService.calculateShipping(province, postalCode, orderAmount));
    }
}
