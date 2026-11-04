package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for the custom-design feature.
 * Bound from the {@code app.design.*} namespace.
 */
@ConfigurationProperties(prefix = "app.design")
@Validated
public record DesignProperties(

        /**
         * Hours after which DRAFT designs without an associated order are purged.
         * Keep low enough to free storage but high enough to not cut off slow connections.
         */
        @Min(value = 1, message = "Draft expiry must be at least 1 hour")
        int draftExpiryHours

) {}
