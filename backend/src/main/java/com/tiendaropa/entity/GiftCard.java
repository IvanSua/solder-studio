package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gift_cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GiftCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal initialAmount;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal remainingAmount;

    @Builder.Default
    @Column(nullable = false)
    private String currencyCode = "ARS";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchased_by_user_id")
    private User purchasedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "redeemed_by_user_id")
    private User redeemedBy;

    @Column(nullable = false)
    private Instant expiresAt;

    /**
     * Gate for spendability. Admin-issued cards are created active=true directly
     * (no payment expected). Customer-purchased cards (GiftCardService.purchaseGiftCard)
     * start FALSE — "awaiting payment" — and are only flipped to true by the
     * MercadoPago webhook once the payment is actually approved. Never grant a
     * customer-purchased card active=true before payment confirmation.
     */
    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    /** MercadoPago payment ID once approved (mirrors Order.paymentExternalId). */
    @Column(name = "payment_external_id", length = 64)
    private String paymentExternalId;

    /** MercadoPago checkout URL for this purchase, so idempotent retries can redirect again. */
    @Column(name = "checkout_url", length = 2048)
    private String checkoutUrl;

    /** Client-generated idempotency key — same purpose as Order.idempotencyKey. */
    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant redeemedAt;

    @PrePersist
    public void generateCode() {
        if (this.code == null) {
            this.code = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
        if (this.initialAmount != null) {
            this.remainingAmount = this.initialAmount;
        }
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isUsable() {
        return active && !isExpired() && remainingAmount.compareTo(BigDecimal.ZERO) > 0;
    }
}
