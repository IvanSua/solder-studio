package com.tiendaropa.service;

import com.tiendaropa.dto.request.CheckoutRequest;
import com.tiendaropa.dto.response.CheckoutResponse;
import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.dto.response.GiftCardResponse;
import com.tiendaropa.dto.response.LoyaltyCheckoutPreviewResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.UserLevel;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.config.properties.CheckoutProperties;
import com.tiendaropa.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.micrometer.core.instrument.Timer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CheckoutService {

    private final CartRepository cartRepository;
    private final OrderRepository orderRepository;
    private final AddressRepository addressRepository;
    private final UserRepository userRepository;
    private final StockService stockService;
    private final MercadoPagoService mercadoPagoService;
    private final PromotionService promotionService;
    private final GiftCardService giftCardService;
    private final ShippingRateRepository shippingRateRepository;
    private final CheckoutProperties checkoutProperties;
    private final PointsService pointsService;
    private final BusinessMetricsService metrics;

    /**
     * Self-injection via @Lazy so we can call the @Transactional doCheckout()
     * from within this same class and still go through the CGLIB proxy — needed
     * so that a DataIntegrityViolationException thrown by the unique idempotency
     * constraint actually rolls back the (failed) transaction *before* control
     * returns here. Same pattern as ProductService (see KI-001).
     */
    @Lazy
    @Autowired
    private CheckoutService self;

    /**
     * Idempotency guard around the real checkout logic. Prevents the classic
     * "bad connection → user clicks Comprar N times / the request is retried →
     * N orders get created" bug: the frontend sends the SAME idempotencyKey on
     * every retry of one checkout attempt, and this method guarantees at most
     * one order is ever created for a given key.
     *
     * <p>Three layers, cheapest first:
     * <ol>
     *   <li>Fast path: an order for this key already exists (the common case —
     *       a sequential retry after the first request already finished) →
     *       return it immediately without touching stock, points or MercadoPago.</li>
     *   <li>Otherwise run the real checkout in its own transaction.</li>
     *   <li>If two requests with the same key race each other and both pass the
     *       fast-path check before either commits, the DB-level unique index on
     *       idempotency_key rejects the second INSERT. We catch that here and
     *       return whichever order actually won the race.</li>
     * </ol>
     */
    public CheckoutResponse checkout(Long userId, CheckoutRequest request) {
        Optional<Order> existing = orderRepository.findByIdempotencyKeyAndUserId(request.getIdempotencyKey(), userId);
        if (existing.isPresent()) {
            log.info("Checkout retry detected (idempotencyKey={}) — returning existing order {} instead of creating a new one",
                    request.getIdempotencyKey(), existing.get().getId());
            return buildResponseFromExistingOrder(existing.get());
        }

        try {
            return self.doCheckout(userId, request);
        } catch (DataIntegrityViolationException e) {
            Order raced = orderRepository.findByIdempotencyKeyAndUserId(request.getIdempotencyKey(), userId)
                    .orElseThrow(() -> e);
            log.warn("Checkout race detected (idempotencyKey={}) — a concurrent request already created order {}; returning it",
                    request.getIdempotencyKey(), raced.getId());
            return buildResponseFromExistingOrder(raced);
        }
    }

    @Transactional
    public CheckoutResponse doCheckout(Long userId, CheckoutRequest request) {
        metrics.checkoutInitiated(request.getPaymentMethod());
        Timer.Sample timerSample = metrics.startCheckoutTimer();
        Cart cart = cartRepository.findByUserIdWithItems(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart not found"));

        if (cart.getItems().isEmpty()) {
            throw new BusinessException("Cart is empty", HttpStatus.BAD_REQUEST);
        }

        Address address = addressRepository.findByIdAndUserId(request.getShippingAddressId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Shipping address not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Calculate totals (amounts stored in centavos)
        long subtotal = 0;
        for (CartItem item : cart.getItems()) {
            subtotal += item.getProductVariant().getPriceAmount() * item.getQuantity();
        }

        // Apply coupon if provided
        long discount = 0L;
        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            CouponValidationResponse couponResult = promotionService.validateCoupon(request.getCouponCode(), subtotal);
            if (!couponResult.isValid()) {
                throw new BusinessException("Cupón inválido: " + couponResult.getMessage(), HttpStatus.BAD_REQUEST);
            }
            discount = couponResult.getDiscountAmount();
        }

        // ── Tier discount (GOLD 5%, PLATINUM 10%) ────────────────────────────
        UserLevel userLevel = user.getLevel();
        int tierPercent = userLevel.getDiscountPercent();
        long tierDiscount = 0L;
        if (tierPercent > 0) {
            long afterCoupon = subtotal - discount;
            tierDiscount = afterCoupon * tierPercent / 100;
        }

        // ── Points redemption ─────────────────────────────────────────────────
        long pointsDiscount = 0L;
        int pointsRedeemed = 0;
        int requestedPoints = request.getPointsToRedeem() != null ? request.getPointsToRedeem() : 0;
        if (requestedPoints > 0) {
            int availablePoints = user.getPoints();
            if (requestedPoints > availablePoints) {
                throw new BusinessException(
                        "Puntos insuficientes: tenés " + availablePoints + " puntos disponibles",
                        HttpStatus.BAD_REQUEST);
            }
            // 1 point = 100 centavos. Max is what's left after coupon + tier discount.
            long afterTier = subtotal - discount - tierDiscount;
            long requestedCents = (long) requestedPoints * 100L;
            pointsDiscount = Math.min(requestedCents, Math.max(0, afterTier));
            pointsRedeemed = (int)(pointsDiscount / 100L);
        }

        // Apply gift card if provided
        long giftCardDiscount = 0L;
        String giftCardCode = null;
        if (request.getGiftCardCode() != null && !request.getGiftCardCode().isBlank()) {
            giftCardCode = request.getGiftCardCode().trim().toUpperCase();
            try {
                GiftCardResponse giftCard = giftCardService.validateGiftCard(giftCardCode);
                // Gift card is applied after coupon + tier + points discounts
                long afterLoyalty = subtotal - discount - tierDiscount - pointsDiscount;
                long giftCardRemaining = giftCard.getRemainingAmount().longValue() * 100; // to centavos
                giftCardDiscount = Math.min(Math.max(0, afterLoyalty), giftCardRemaining);
            } catch (Exception e) {
                throw new BusinessException("Gift Card inválida: " + e.getMessage(), HttpStatus.BAD_REQUEST);
            }
        }

        // Resolve shipping cost if a rate was selected
        long shippingAmount = 0L;
        if (request.getShippingRateId() != null) {
            var rateOpt = shippingRateRepository.findById(request.getShippingRateId());
            if (rateOpt.isPresent()) {
                var rate = rateOpt.get();
                boolean isFree = rate.getFreeShippingThreshold() != null
                        && subtotal >= rate.getFreeShippingThreshold();
                shippingAmount = isFree ? 0L : rate.getPriceAmount();
            }
        }
        final long effectiveShippingAmount = shippingAmount;

        long total = Math.max(0, subtotal - discount - tierDiscount - pointsDiscount - giftCardDiscount)
                + effectiveShippingAmount;

        String paymentMethod = request.getPaymentMethod().toUpperCase().strip();
        int installments = (request.getInstallments() != null) ? request.getInstallments() : 1;

        // Create order
        Order order = Order.builder()
                .user(user)
                .status(OrderStatus.AWAITING_PAYMENT)
                .shippingAddress(address)
                .subtotalAmount(subtotal)
                .discountAmount(discount)
                .loyaltyTierDiscountAmount(tierDiscount)
                .loyaltyPointsDiscountAmount(pointsDiscount)
                .loyaltyPointsRedeemed(pointsRedeemed)
                .giftCardCode(giftCardCode)
                .giftCardDiscountAmount(giftCardDiscount)
                .taxAmount(0L)
                .shippingAmount(effectiveShippingAmount)
                .totalAmount(total)
                .currencyCode("ARS")
                .paymentProvider(paymentMethod)
                .paymentMethod(paymentMethod)
                .installments(installments)
                .idempotencyKey(request.getIdempotencyKey())
                .items(new ArrayList<>())
                .build();

        order = orderRepository.save(order);

        // Create order items and reserve stock
        for (CartItem cartItem : cart.getItems()) {
            ProductVariant variant = cartItem.getProductVariant();

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .productVariant(variant)
                    .quantity(cartItem.getQuantity())
                    .unitPriceAmount(variant.getPriceAmount())
                    .currencyCode(variant.getCurrencyCode())
                    .customDesign(cartItem.getCustomDesign())
                    .productName(variant.getProduct().getName())
                    .variantColor(variant.getColor())
                    .variantSize(variant.getSize())
                    .build();

            order.getItems().add(orderItem);
            stockService.reserveStock(variant.getId(), cartItem.getQuantity(), user, order);
        }

        order = orderRepository.save(order);

        // ── Deduct redeemed points immediately ────────────────────────────────
        if (pointsRedeemed > 0) {
            pointsService.redeemPoints(userId, pointsRedeemed, order.getId());
            metrics.pointsRedeemed(pointsRedeemed);
        }
        if (discount > 0)         metrics.couponValidated(true);
        if (giftCardDiscount > 0) metrics.giftCardRedeemed();

        // ── Payment session ───────────────────────────────────────────────────
        // Only MERCADOPAGO requires an external checkout URL.
        // TRANSFER and CASH go directly to order confirmation.
        String checkoutUrl = null;
        if ("MERCADOPAGO".equals(paymentMethod)) {
            checkoutUrl = mercadoPagoService.createPreference(order, cart, user);
            order.setPaymentCheckoutUrl(checkoutUrl);
            order = orderRepository.save(order);
        }

        Instant expiresAt = Instant.now().plus(checkoutProperties.reservationExpiryMinutes(), ChronoUnit.MINUTES);

        final int finalPointsRedeemed = pointsRedeemed;
        final long finalTierDiscount  = tierDiscount;

        CheckoutResponse response = CheckoutResponse.builder()
                .orderId(order.getId())
                .reservationExpiresAt(expiresAt)
                .paymentSession(CheckoutResponse.PaymentSession.builder()
                        .provider(paymentMethod)
                        .checkoutUrl(checkoutUrl)
                        .build())
                .amounts(CheckoutResponse.OrderAmounts.builder()
                        .subtotal(order.getSubtotalAmount())
                        .discount(order.getDiscountAmount())
                        .tierDiscount(finalTierDiscount)
                        .tierDiscountPercent(tierPercent)
                        .pointsDiscount(order.getLoyaltyPointsDiscountAmount())
                        .pointsRedeemed(order.getLoyaltyPointsRedeemed())
                        .giftCardDiscount(order.getGiftCardDiscountAmount())
                        .tax(order.getTaxAmount())
                        .shipping(order.getShippingAmount())
                        .total(order.getTotalAmount())
                        .currency(order.getCurrencyCode())
                        .build())
                .couponApplied(discount > 0 ? request.getCouponCode().trim().toUpperCase() : null)
                .giftCardApplied(giftCardDiscount > 0 ? giftCardCode : null)
                .giftCardDiscount(giftCardDiscount)
                .loyaltyTierApplied(tierPercent > 0 ? userLevel.name() : null)
                .loyaltyPointsRedeemed(finalPointsRedeemed)
                .build();

        metrics.checkoutCompleted(paymentMethod, true);
        metrics.stopCheckoutTimer(timerSample, paymentMethod, true);
        return response;
    }

    /**
     * Rebuilds the CheckoutResponse for an order that was already created by an
     * earlier (or concurrently racing) request with the same idempotency key.
     * Used by both the fast-path retry check and the DataIntegrityViolation
     * fallback in {@link #checkout}. Does NOT touch stock, points or MercadoPago
     * again — the order already reflects the one real checkout that happened.
     */
    private CheckoutResponse buildResponseFromExistingOrder(Order order) {
        Instant expiresAt = order.getCreatedAt()
                .plus(checkoutProperties.reservationExpiryMinutes(), ChronoUnit.MINUTES);

        return CheckoutResponse.builder()
                .orderId(order.getId())
                .reservationExpiresAt(expiresAt)
                .paymentSession(CheckoutResponse.PaymentSession.builder()
                        .provider(order.getPaymentMethod())
                        .checkoutUrl(order.getPaymentCheckoutUrl())
                        .build())
                .amounts(CheckoutResponse.OrderAmounts.builder()
                        .subtotal(order.getSubtotalAmount())
                        .discount(order.getDiscountAmount())
                        .giftCardDiscount(order.getGiftCardDiscountAmount())
                        .tierDiscount(order.getLoyaltyTierDiscountAmount())
                        .tierDiscountPercent(null)
                        .pointsDiscount(order.getLoyaltyPointsDiscountAmount())
                        .pointsRedeemed(order.getLoyaltyPointsRedeemed())
                        .tax(order.getTaxAmount())
                        .shipping(order.getShippingAmount())
                        .total(order.getTotalAmount())
                        .currency(order.getCurrencyCode())
                        .build())
                .giftCardApplied(order.getGiftCardCode())
                .giftCardDiscount(order.getGiftCardDiscountAmount())
                .loyaltyPointsRedeemed(order.getLoyaltyPointsRedeemed())
                .build();
    }

    // ── Loyalty preview ───────────────────────────────────────────────────────

    /**
     * Returns the loyalty discounts that would apply at checkout without creating an order.
     * Used by the frontend to show a live discount breakdown.
     *
     * @param userId          authenticated user
     * @param subtotalCents   cart subtotal in centavos (after coupon, before loyalty)
     * @param pointsRequested how many points the user wants to redeem (0 = none)
     */
    @Transactional(readOnly = true)
    public LoyaltyCheckoutPreviewResponse previewLoyaltyDiscount(
            Long userId, long subtotalCents, int pointsRequested) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UserLevel level = user.getLevel();
        int tierPercent = level.getDiscountPercent();
        long tierDiscount = subtotalCents * tierPercent / 100;

        long afterTier = Math.max(0, subtotalCents - tierDiscount);
        int available = user.getPoints();

        // Max redeemable: limited by balance and remaining order amount
        // 1 pt = 100 centavos, so max points from amount = afterTier / 100
        int maxFromBalance = available;
        int maxFromAmount  = (int)(afterTier / 100L);
        int maxRedeemable  = Math.min(maxFromBalance, maxFromAmount);

        // Points the user actually requested (capped)
        int toRedeem = Math.min(Math.max(0, pointsRequested), maxRedeemable);
        long pointsDiscountCents = toRedeem * 100L;

        return LoyaltyCheckoutPreviewResponse.builder()
                .availablePoints(available)
                .level(level.name())
                .levelLabel(level.getLabel())
                .tierDiscountPercent(tierPercent)
                .tierDiscountAmount(tierDiscount)
                .maxRedeemablePoints(maxRedeemable)
                .pointsDiscountAmount(pointsDiscountCents)
                .pointsRedeemed(toRedeem)
                .build();
    }
}
