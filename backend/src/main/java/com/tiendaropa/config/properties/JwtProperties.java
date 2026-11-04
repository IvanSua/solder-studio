package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for JWT token generation.
 *
 * <p>Bound from the {@code app.jwt.*} namespace. Spring Boot validates these
 * constraints at startup — a misconfigured secret fails fast before serving traffic.
 */
@ConfigurationProperties(prefix = "app.jwt")
@Validated
public record JwtProperties(

        /**
         * HMAC-SHA256 signing secret. Must be at least 32 characters (256 bits).
         * Set via the {@code JWT_SECRET} environment variable in production.
         */
        @NotBlank(message = "JWT secret must not be blank")
        @Size(min = 32, message = "JWT secret must be at least 32 characters (256 bits)")
        String secret,

        /** Access token lifetime in milliseconds. Default: 24 h. */
        @Min(value = 60_000, message = "JWT expiration must be at least 60 000 ms (1 minute)")
        long expirationMs,

        /** Refresh token lifetime in milliseconds. Default: 7 days. */
        @Min(value = 60_000, message = "JWT refresh expiration must be at least 60 000 ms (1 minute)")
        long refreshExpirationMs

) {}
