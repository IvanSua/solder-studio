package com.tiendaropa.service;

import com.tiendaropa.dto.request.GiftCardPurchaseRequest;
import com.tiendaropa.dto.response.GiftCardResponse;
import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.GiftCardRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GiftCardService {

    private final GiftCardRepository giftCardRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final MercadoPagoService mercadoPagoService;

    /** Self-injection for the same reason as CheckoutService — see checkout(). */
    @Lazy
    @Autowired
    private GiftCardService self;

    /**
     * Idempotency guard, same pattern as CheckoutService.checkout(). Prevents a
     * retried/duplicated request from creating two pending gift card purchases
     * (and two MercadoPago preferences) for what the user only intended as one.
     */
    public GiftCardResponse purchaseGiftCard(Long userId, GiftCardPurchaseRequest request) {
        Optional<GiftCard> existing =
                giftCardRepository.findByIdempotencyKeyAndPurchasedById(request.getIdempotencyKey(), userId);
        if (existing.isPresent()) {
            log.info("Gift card purchase retry detected (idempotencyKey={}) — returning existing card {}",
                    request.getIdempotencyKey(), existing.get().getId());
            return toResponse(existing.get());
        }

        try {
            return self.doPurchaseGiftCard(userId, request);
        } catch (DataIntegrityViolationException e) {
            GiftCard raced = giftCardRepository.findByIdempotencyKeyAndPurchasedById(request.getIdempotencyKey(), userId)
                    .orElseThrow(() -> e);
            log.warn("Gift card purchase race detected (idempotencyKey={}) — returning card {} created by concurrent request",
                    request.getIdempotencyKey(), raced.getId());
            return toResponse(raced);
        }
    }

    /**
     * Creates a gift card in "awaiting payment" state (active=false — NOT
     * spendable) and a MercadoPago Checkout Pro preference for it. The card is
     * only activated by PaymentWebhookService once MercadoPago confirms the
     * payment was actually approved.
     *
     * <p>CRITICAL: this used to grant a spendable gift card immediately, with no
     * payment step at all — any authenticated user could mint up to $50,000 ARS
     * of real store credit per request for free. Do not set active=true here.
     */
    @Transactional
    public GiftCardResponse doPurchaseGiftCard(Long userId, GiftCardPurchaseRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        GiftCard giftCard = GiftCard.builder()
                .initialAmount(request.getAmount())
                .remainingAmount(request.getAmount())
                .currencyCode("ARS")
                .purchasedBy(user)
                .expiresAt(Instant.now().plus(365, ChronoUnit.DAYS)) // 1 year validity from purchase
                .active(false) // awaiting payment — activated by the MP webhook on approval
                .idempotencyKey(request.getIdempotencyKey())
                .build();

        GiftCard saved = giftCardRepository.save(giftCard);

        String checkoutUrl = mercadoPagoService.createGiftCardPreference(saved, user);
        saved.setCheckoutUrl(checkoutUrl);
        saved = giftCardRepository.save(saved);

        GiftCardResponse response = toResponse(saved);
        response.setCheckoutUrl(checkoutUrl);
        return response;
    }

    public GiftCardResponse getGiftCardByCode(String code) {
        GiftCard giftCard = giftCardRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Gift card not found"));
        return toResponse(giftCard);
    }

    public List<GiftCardResponse> getUserGiftCards(Long userId) {
        return giftCardRepository.findByPurchasedById(userId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public GiftCardResponse redeemGiftCard(String code, Long userId) {
        GiftCard giftCard = giftCardRepository.findUsableByCode(code.toUpperCase(), Instant.now())
                .orElseThrow(() -> new ResourceNotFoundException("Gift card not found or expired"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        giftCard.setRedeemedBy(user);
        giftCard.setRedeemedAt(Instant.now());

        GiftCard saved = giftCardRepository.save(giftCard);
        return toResponse(saved);
    }

    public BigDecimal getUserGiftCardBalance(Long userId) {
        BigDecimal balance = giftCardRepository.sumRemainingByUserId(userId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    public GiftCardResponse validateGiftCard(String code) {
        GiftCard giftCard = giftCardRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Gift card not found"));

        if (!giftCard.isActive()) {
            throw new BusinessException("Gift card is no longer active", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (giftCard.isExpired()) {
            throw new BusinessException("Gift card has expired", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (giftCard.getRemainingAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Gift card has no remaining balance", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        
        return toResponse(giftCard);
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
}
