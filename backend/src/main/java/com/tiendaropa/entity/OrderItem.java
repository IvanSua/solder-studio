package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_variant_id", nullable = false)
    private ProductVariant productVariant;

    @Column(nullable = false)
    private Integer quantity;

    /** Snapshot of price at time of purchase, in minimum currency unit */
    @Column(nullable = false)
    private Long unitPriceAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currencyCode = "ARS";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "custom_design_id")
    private CustomDesign customDesign;

    /** Snapshot of product name at time of purchase */
    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private String variantColor;

    @Column(nullable = false)
    private String variantSize;
}
