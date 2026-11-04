package com.tiendaropa.controller;

import com.tiendaropa.dto.request.GiftCardPurchaseRequest;
import jakarta.validation.Valid;
import com.tiendaropa.dto.response.GiftCardResponse;
import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.User;
import com.tiendaropa.repository.GiftCardRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/v1/admin/gift-cards")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminGiftCardController {

    private final GiftCardRepository giftCardRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<GiftCardResponse>> getAllGiftCards(Pageable pageable) {
        return ResponseEntity.ok(giftCardRepository.findAll(pageable).map(this::toResponse));
    }

    @PostMapping
    public ResponseEntity<GiftCardResponse> createGiftCard(
            @Valid @RequestBody GiftCardPurchaseRequest request,
            @RequestParam(required = false) Long userId) {
        
        GiftCard giftCard = GiftCard.builder()
                .initialAmount(request.getAmount())
                .remainingAmount(request.getAmount())
                .currencyCode("ARS")
                .expiresAt(Instant.now().plus(365, ChronoUnit.DAYS))
                .active(true)
                .build();

        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            giftCard.setPurchasedBy(user);
        }

        GiftCard saved = giftCardRepository.save(giftCard);
        return ResponseEntity.ok(toResponse(saved));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GiftCardResponse> getGiftCard(@PathVariable Long id) {
        GiftCard giftCard = giftCardRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Gift card not found"));
        return ResponseEntity.ok(toResponse(giftCard));
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<GiftCardResponse> getGiftCardByCode(@PathVariable String code) {
        GiftCard giftCard = giftCardRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Gift card not found"));
        return ResponseEntity.ok(toResponse(giftCard));
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<GiftCardResponse> deactivateGiftCard(@PathVariable Long id) {
        GiftCard giftCard = giftCardRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Gift card not found"));
        giftCard.setActive(false);
        GiftCard saved = giftCardRepository.save(giftCard);
        return ResponseEntity.ok(toResponse(saved));
    }

    @GetMapping("/stats")
    public ResponseEntity<GiftCardStats> getStats() {
        long totalCards = giftCardRepository.count();
        BigDecimal totalValue = giftCardRepository.sumAllRemainingAmount();
        return ResponseEntity.ok(new GiftCardStats(totalCards, totalValue));
    }

    private GiftCardResponse toResponse(GiftCard giftCard) {
        return GiftCardResponse.builder()
                .id(giftCard.getId())
                .code(giftCard.getCode())
                .initialAmount(giftCard.getInitialAmount())
                .remainingAmount(giftCard.getRemainingAmount())
                .currencyCode(giftCard.getCurrencyCode())
                .purchasedByUserId(giftCard.getPurchasedBy() != null ? giftCard.getPurchasedBy().getId() : null)
                .redeemedByUserId(giftCard.getRedeemedBy() != null ? giftCard.getRedeemedBy().getId() : null)
                .expiresAt(giftCard.getExpiresAt())
                .active(giftCard.isActive())
                .expired(giftCard.isExpired())
                .usable(giftCard.isUsable())
                .createdAt(giftCard.getCreatedAt())
                .redeemedAt(giftCard.getRedeemedAt())
                .build();
    }

    public record GiftCardStats(long totalCards, BigDecimal totalValue) {}
}
