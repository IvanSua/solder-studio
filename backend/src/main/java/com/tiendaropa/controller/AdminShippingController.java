package com.tiendaropa.controller;

import com.tiendaropa.dto.request.ShippingRateRequest;
import jakarta.validation.Valid;
import com.tiendaropa.entity.ShippingRate;
import com.tiendaropa.service.ShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/shipping")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminShippingController {

    private final ShippingService shippingService;

    @GetMapping
    public ResponseEntity<List<ShippingRate>> getAllRates() {
        return ResponseEntity.ok(shippingService.getAllRates());
    }

    @PostMapping
    public ResponseEntity<ShippingRate> createRate(@Valid @RequestBody ShippingRateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shippingService.createRate(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShippingRate> updateRate(
            @PathVariable Long id,
            @Valid @RequestBody ShippingRateRequest request) {
        return ResponseEntity.ok(shippingService.updateRate(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRate(@PathVariable Long id) {
        shippingService.deleteRate(id);
        return ResponseEntity.noContent().build();
    }
}
