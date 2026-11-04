package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for authentication security policies.
 * Bound from the {@code app.auth.*} namespace.
 */
@ConfigurationProperties(prefix = "app.auth")
@Validated
public record AuthProperties(

        /** Number of consecutive failed login attempts before the account is locked. */
        @Min(value = 1, message = "Max failed attempts must be at least 1")
        int maxFailedAttempts,

        /** Duration of the temporary account lockout in minutes. */
        @Min(value = 1, message = "Lockout duration must be at least 1 minute")
        int lockoutMinutes,

        /** Lifetime of password-reset and email-verification tokens in minutes. */
        @Min(value = 1, message = "Token expiry must be at least 1 minute")
        int tokenExpiryMinutes,

        /** Email verification link lifetime in hours. */
        @Min(value = 1, message = "Verification token lifetime must be at least 1 hour")
        int verificationTokenHours,

        /** Per-IP rate limits for sensitive endpoints (requests per minute). */
        RateLimit rateLimit,

        /**
         * Number of trusted reverse-proxy hops in front of the app (e.g. Railway's / Render's
         * edge proxy = 1). Used to pick the correct client IP out of the X-Forwarded-For chain
         * without trusting a value an attacker could prepend themselves.
         */
        @Min(0)
        int trustedProxyHops

) {
    public record RateLimit(
            @Min(1) int login,
            @Min(1) int register,
            @Min(1) int forgotPassword,
            @Min(1) int payments,
            /** Fallback limit applied to every other route, per IP (requests per minute). */
            @Min(1) int global
    ) {}
}
