package com.tiendaropa.entity;

import com.tiendaropa.enums.OrderStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@NamedEntityGraph(
        name = "Order.withDetails",
        attributeNodes = {
                @NamedAttributeNode("user"),
                @NamedAttributeNode("shippingAddress"),
                @NamedAttributeNode(value = "items", subgraph = "items-subgraph")
        },
        subgraphs = {
                @NamedSubgraph(name = "items-subgraph", attributeNodes = {
                        @NamedAttributeNode(value = "productVariant", subgraph = "variant-subgraph"),
                        @NamedAttributeNode("customDesign")
                }),
                // product is loaded eagerly to avoid N+1; product.images is lazy-loaded
                // within the @Transactional(readOnly = true) session — do NOT add images here
                // or Hibernate generates a second bag fetch that can fail.
                @NamedSubgraph(name = "variant-subgraph", attributeNodes = {
                        @NamedAttributeNode("product")
                })
        }
)
@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_user_created", columnList = "user_id, created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipping_address_id")
    private Address shippingAddress;

    /** All amounts in minimum currency unit (centavos) */
    @Column(nullable = false)
    private Long subtotalAmount;

    @Column(nullable = false)
    @Builder.Default
    private Long discountAmount = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Long taxAmount = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Long shippingAmount = 0L;

    @Column(nullable = false)
    private Long totalAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currencyCode = "ARS";

    private String paymentProvider;
    private String paymentExternalId;

    /** MercadoPago (or other provider) checkout URL, saved so idempotent retries
     *  of the same checkout attempt can redirect the user again without creating
     *  a new payment preference. */
    @Column(length = 2048)
    private String paymentCheckoutUrl;

    /**
     * Client-generated idempotency key (one per checkout attempt, resent unchanged
     * on retries). Enforced unique at the DB level (see V13 migration) so a request
     * that's retried due to a network error/timeout/double-click can never create
     * more than one order — the retry just returns the original order instead.
     */
    @Column(length = 64)
    private String idempotencyKey;

    /**
     * Payment method chosen at checkout: MERCADOPAGO, TRANSFER, CASH.
     * Stored as a plain string for forward-compatibility.
     */
    @Column(length = 30)
    private String paymentMethod;

    /**
     * Number of installments chosen by the buyer (1 = lump-sum).
     * Only meaningful when paymentMethod = MERCADOPAGO.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer installments = 1;

    /** Gift card code applied at checkout (if any) */
    private String giftCardCode;

    /** Amount discounted via gift card (in centavos) */
    @Builder.Default
    private Long giftCardDiscountAmount = 0L;

    /** Automatic tier discount (GOLD 5% / PLATINUM 10%) in centavos */
    @Column(nullable = false)
    @Builder.Default
    private Long loyaltyTierDiscountAmount = 0L;

    /** Discount applied by redeeming loyalty points (in centavos) */
    @Column(nullable = false)
    @Builder.Default
    private Long loyaltyPointsDiscountAmount = 0L;

    /** Number of loyalty points redeemed at checkout */
    @Column(nullable = false)
    @Builder.Default
    private Integer loyaltyPointsRedeemed = 0;

    /** Shipping tracking — set by admin once order is shipped */
    private String trackingNumber;
    private String trackingUrl;

    /** Estimated delivery date — set at checkout time */
    private Instant estimatedDeliveryAt;

    /** Internal notes visible only to admins/workers */
    @Column(columnDefinition = "TEXT")
    private String adminNotes;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 30)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
