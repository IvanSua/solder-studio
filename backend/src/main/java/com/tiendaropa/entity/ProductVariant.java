package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "product_variants",
       uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "color", "size"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private String size;

    /** Price in minimum currency unit (centavos for ARS) */
    @Column(nullable = false)
    private Long priceAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currencyCode = "ARS";

    @Column(nullable = false)
    @Builder.Default
    private Integer stockTotal = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer stockReserved = 0;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    private String sku;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public int getStockAvailable() {
        return stockTotal - stockReserved;
    }
}
