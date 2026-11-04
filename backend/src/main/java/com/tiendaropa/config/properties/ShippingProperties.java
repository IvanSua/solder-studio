package com.tiendaropa.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;

/**
 * Shipping configuration bound from the {@code app.shipping.*} namespace.
 */
@ConfigurationProperties(prefix = "app.shipping")
@Validated
public record ShippingProperties(

        /** Postal code of the warehouse / dispatch origin. E.g.: B1778 */
        @NotBlank(message = "Origin postal code must be set (app.shipping.origin-postal-code)")
        String originPostalCode

) {}
