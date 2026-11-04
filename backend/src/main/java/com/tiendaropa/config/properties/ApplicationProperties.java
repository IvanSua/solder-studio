package com.tiendaropa.config.properties;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Top-level application properties that don't belong to a specific subsystem.
 * Bound from the {@code app.*} namespace.
 */
@ConfigurationProperties(prefix = "app")
@Validated
public record ApplicationProperties(

        /**
         * Public URL of the Angular frontend.
         * Used to build redirect and confirmation links in emails and OAuth2 callbacks.
         * Set via the {@code FRONTEND_URL} environment variable in production.
         */
        @NotBlank(message = "app.frontend-url must not be blank")
        String frontendUrl

) {}
