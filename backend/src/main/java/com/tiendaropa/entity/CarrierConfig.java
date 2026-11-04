package com.tiendaropa.entity;

import com.tiendaropa.enums.CarrierMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "carrier_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarrierConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String carrierCode;

    @Column(nullable = false, length = 100)
    private String carrierName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private CarrierMode mode = CarrierMode.MANUAL;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /** API username / email. Null = not yet configured. */
    private String apiUsername;

    /** API password. Stored as-is; use env vars in production for sensitive deployments. */
    private String apiPassword;

    /** Carrier-specific client/account number. */
    private String apiClientNumber;

    /** CUIT u otro token específico del carrier. */
    private String apiKey;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
