package com.tiendaropa.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Centralised business-level metrics.
 *
 * All metrics are prefixed with {@code tienda.} so they're easy to filter in
 * Prometheus / Grafana without conflicting with JVM or Spring Boot built-ins.
 *
 * Usage:
 * <pre>
 *   metrics.checkoutInitiated("MERCADOPAGO");
 *   var sample = metrics.startCheckoutTimer();
 *   // ... do work ...
 *   metrics.stopCheckoutTimer(sample, "MERCADOPAGO", true);
 * </pre>
 */
@Service
@Slf4j
public class BusinessMetricsService {

    // ── Counters ─────────────────────────────────────────────────────────────

    private static final String CHECKOUT_INITIATED   = "tienda.checkout.initiated";
    private static final String CHECKOUT_COMPLETED   = "tienda.checkout.completed";
    private static final String ORDER_STATUS_CHANGED = "tienda.order.status_changed";
    private static final String POINTS_AWARDED       = "tienda.loyalty.points_awarded";
    private static final String POINTS_REDEEMED      = "tienda.loyalty.points_redeemed";
    private static final String COUPON_VALIDATED     = "tienda.coupon.validated";
    private static final String GIFT_CARD_REDEEMED   = "tienda.gift_card.redeemed";
    private static final String REFERRAL_BONUS       = "tienda.referral.bonus_awarded";

    // ── Timers ───────────────────────────────────────────────────────────────

    private static final String CHECKOUT_DURATION = "tienda.checkout.duration";

    private final MeterRegistry registry;

    public BusinessMetricsService(MeterRegistry registry) {
        this.registry = registry;
    }

    // ── Checkout ──────────────────────────────────────────────────────────────

    /**
     * Call when a checkout request is received (before processing).
     */
    public void checkoutInitiated(String paymentMethod) {
        Counter.builder(CHECKOUT_INITIATED)
                .description("Total checkout attempts")
                .tag("payment_method", normalise(paymentMethod))
                .register(registry)
                .increment();
    }

    /**
     * Call when checkout processing finishes (success or error).
     *
     * @param paymentMethod  MERCADOPAGO | TRANSFER | CASH
     * @param success        true = order created; false = exception thrown
     */
    public void checkoutCompleted(String paymentMethod, boolean success) {
        Counter.builder(CHECKOUT_COMPLETED)
                .description("Checkout completions by result")
                .tag("payment_method", normalise(paymentMethod))
                .tag("result", success ? "success" : "error")
                .register(registry)
                .increment();
    }

    /**
     * Start timing a checkout operation.
     *
     * @return a sample to pass to {@link #stopCheckoutTimer}
     */
    public Timer.Sample startCheckoutTimer() {
        return Timer.start(registry);
    }

    /**
     * Stop the timer and record the duration.
     */
    public void stopCheckoutTimer(Timer.Sample sample, String paymentMethod, boolean success) {
        Timer timer = Timer.builder(CHECKOUT_DURATION)
                .description("Time to complete a checkout request")
                .tag("payment_method", normalise(paymentMethod))
                .tag("result", success ? "success" : "error")
                .register(registry);
        sample.stop(timer);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    /**
     * Call whenever an admin changes an order's status.
     *
     * @param newStatus  the target status (e.g. "DELIVERED")
     */
    public void orderStatusChanged(String newStatus) {
        Counter.builder(ORDER_STATUS_CHANGED)
                .description("Order status transitions")
                .tag("to_status", normalise(newStatus))
                .register(registry)
                .increment();
    }

    // ── Loyalty ───────────────────────────────────────────────────────────────

    /**
     * Call when points are awarded for any reason.
     *
     * @param reason  ORDER_DELIVERED | REFERRAL_BONUS | REFERRAL_FIRST_PURCHASE | …
     * @param amount  number of points (use positive value even for redemptions)
     */
    public void pointsAwarded(String reason, int amount) {
        Counter.builder(POINTS_AWARDED)
                .description("Loyalty points awarded (excluding redemptions)")
                .tag("reason", normalise(reason))
                .register(registry)
                .increment(amount);
    }

    /**
     * Call when points are redeemed at checkout.
     *
     * @param amount  points spent (positive integer)
     */
    public void pointsRedeemed(int amount) {
        Counter.builder(POINTS_REDEEMED)
                .description("Loyalty points redeemed at checkout")
                .register(registry)
                .increment(amount);
    }

    /**
     * Call when a referral bonus is awarded (signup or first-purchase tier).
     *
     * @param bonusType  SIGNUP | FIRST_PURCHASE
     */
    public void referralBonusAwarded(String bonusType) {
        Counter.builder(REFERRAL_BONUS)
                .description("Referral bonuses awarded")
                .tag("type", normalise(bonusType))
                .register(registry)
                .increment();
    }

    // ── Coupons & Gift Cards ──────────────────────────────────────────────────

    /**
     * Call after a coupon validation attempt.
     *
     * @param valid true = coupon is valid and was applied
     */
    public void couponValidated(boolean valid) {
        Counter.builder(COUPON_VALIDATED)
                .description("Coupon validation attempts")
                .tag("result", valid ? "valid" : "invalid")
                .register(registry)
                .increment();
    }

    /**
     * Call when a gift card is successfully applied at checkout.
     */
    public void giftCardRedeemed() {
        Counter.builder(GIFT_CARD_REDEEMED)
                .description("Gift cards redeemed at checkout")
                .register(registry)
                .increment();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String normalise(String value) {
        return value == null ? "unknown" : value.toUpperCase();
    }
}
