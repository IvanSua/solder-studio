package com.tiendaropa.config;

import com.tiendaropa.config.properties.MercadoPagoProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class MercadoPagoConfig {

    private final MercadoPagoProperties mpProperties;

    @PostConstruct
    public void init() {
        String accessToken = mpProperties.accessToken();
        if (accessToken == null || accessToken.isBlank()) {
            log.warn("MercadoPago access token not configured (MP_ACCESS_TOKEN). " +
                     "Checkout Pro will return a placeholder URL until it is set.");
            return;
        }
        // Use fully qualified name to avoid clash with this class name
        com.mercadopago.MercadoPagoConfig.setAccessToken(accessToken);
        log.info("MercadoPago SDK initialized. Sandbox mode: {}",
                 accessToken.startsWith("TEST-"));
    }

    public boolean isConfigured() {
        String token = mpProperties.accessToken();
        return token != null && !token.isBlank();
    }

    public boolean isSandbox() {
        return isConfigured() && mpProperties.accessToken().startsWith("TEST-");
    }
}
