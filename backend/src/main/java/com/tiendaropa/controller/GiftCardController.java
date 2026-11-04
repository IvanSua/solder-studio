package com.tiendaropa.controller;

import com.tiendaropa.dto.request.GiftCardPurchaseRequest;
import com.tiendaropa.dto.response.GiftCardResponse;
import com.tiendaropa.service.GiftCardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/gift-cards")
@RequiredArgsConstructor
public class GiftCardController {

    private final GiftCardService giftCardService;

    // NOTA: el JwtAuthenticationFilter mete el userId (Long) como principal del
    // Authentication (no un UserDetails), por eso acá usamos Authentication +
    // (Long) auth.getPrincipal() en vez de @AuthenticationPrincipal UserDetails
    // (ese patrón siempre devolvía null y tiraba NPE en estos 3 endpoints).

    @PostMapping("/purchase")
    public ResponseEntity<GiftCardResponse> purchaseGiftCard(
            Authentication auth,
            @Valid @RequestBody GiftCardPurchaseRequest request) {
        return ResponseEntity.ok(giftCardService.purchaseGiftCard((Long) auth.getPrincipal(), request));
    }

    @GetMapping("/my-cards")
    public ResponseEntity<List<GiftCardResponse>> getMyGiftCards(Authentication auth) {
        return ResponseEntity.ok(giftCardService.getUserGiftCards((Long) auth.getPrincipal()));
    }

    @GetMapping("/my-balance")
    public ResponseEntity<BigDecimal> getMyBalance(Authentication auth) {
        return ResponseEntity.ok(giftCardService.getUserGiftCardBalance((Long) auth.getPrincipal()));
    }

    @GetMapping("/validate/{code}")
    public ResponseEntity<GiftCardResponse> validateGiftCard(@PathVariable String code) {
        return ResponseEntity.ok(giftCardService.validateGiftCard(code));
    }

    @PostMapping("/redeem/{code}")
    public ResponseEntity<GiftCardResponse> redeemGiftCard(
            @PathVariable String code,
            Authentication auth) {
        return ResponseEntity.ok(giftCardService.redeemGiftCard(code, (Long) auth.getPrincipal()));
    }
}
