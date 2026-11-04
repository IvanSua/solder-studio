package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "shipping_rates", indexes = {
        @Index(name = "idx_shipping_rates_province", columnList = "province"),
        @Index(name = "idx_shipping_rates_active", columnList = "active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String province;

    @Column(length = 10)
    private String postalCodePrefix;

    @Column(nullable = false, length = 100)
    private String carrierName;

    @Column(nullable = false)
    private int deliveryDaysMin;

    @Column(nullable = false)
    private int deliveryDaysMax;

    @Column(nullable = false)
    private long priceAmount;

    private Long freeShippingThreshold;

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
