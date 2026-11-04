package com.tiendaropa.entity;

import com.tiendaropa.enums.PromotionScope;
import com.tiendaropa.enums.PromotionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "promotions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** Optional unique coupon code for manual redemption (e.g. "VERANO20") */
    @Column(unique = true)
    private String code;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PromotionScope scope;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PromotionType type;

    /** Discount value: percentage (e.g. 1500 = 15.00%) or fixed amount in centavos */
    @Column(nullable = false)
    private Long value;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(nullable = false)
    @Builder.Default
    private boolean stackable = false;

    private String exclusiveGroup;

    private Long targetProductId;
    private Long targetCategoryId;

    private Long minimumPurchaseAmount;

    @Column(nullable = false)
    private Instant startsAt;

    @Column(nullable = false)
    private Instant endsAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
