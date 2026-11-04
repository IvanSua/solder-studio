package com.tiendaropa.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed configuration for the MercadoPago payment gateway.
 * Bound from the {@code app.mercadopago.*} namespace.
 *
 * <p>Fields are intentionally not {@code @NotBlank} because they are optional
 * in development/test. {@link com.tiendaropa.config.MercadoPagoConfig} logs a
 * warning when {@code accessToken} is blank so the operator is aware.
 */
@ConfigurationProperties(prefix = "app.mercadopago")
@Validated
public record MercadoPagoProperties(

        String accessToken,

        String webhookSecret,

        String notificationUrl

) {}
