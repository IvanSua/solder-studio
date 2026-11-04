package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for the webhook retry mechanism.
 * Bound from the {@code app.webhook.*} namespace.
 */
@ConfigurationProperties(prefix = "app.webhook")
@Validated
public record WebhookProperties(

        /** Milliseconds between each retry job run. */
        @Min(value = 1000, message = "Retry interval must be at least 1000 ms")
        long retryIntervalMs,

        /** Maximum number of events processed per job run. */
        @Min(value = 1, message = "Retry batch size must be at least 1")
        int retryBatchSize

) {}
