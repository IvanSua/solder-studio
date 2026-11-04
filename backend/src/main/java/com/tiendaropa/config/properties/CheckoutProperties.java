package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for the checkout flow.
 * Bound from the {@code app.checkout.*} namespace.
 */
@ConfigurationProperties(prefix = "app.checkout")
@Validated
public record CheckoutProperties(

        /** Minutes a stock reservation is held while the user completes payment. */
        @Min(value = 1, message = "Reservation expiry must be at least 1 minute")
        int reservationExpiryMinutes

) {}
