package com.tiendaropa.service.carrier;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Correo Argentino carrier adapter.
 *
 * <p>API: REST — https://apis.correoargentino.com.ar
 *
 * <p>Required credentials in CarrierConfig:
 * <ul>
 *   <li>{@code apiUsername}     — CUIT + username for the business portal</li>
 *   <li>{@code apiPassword}     — Portal password</li>
 *   <li>{@code apiClientNumber} — Número de cliente Correo Argentino</li>
 * </ul>
 *
 * <p>TODO: Implement REST calls when credentials are available.
 * Authentication: OAuth2 client_credentials flow.
 * Endpoint: GET /v3/tarifas?cpOrigen=B1778&cpDestino=X&peso=Y&alto=Z&ancho=W&largo=L
 */
@Component
@Slf4j
public class CorreoArgentinoCarrierAdapter implements CarrierAdapter {

    @Override
    public String getCarrierCode() {
        return "CORREO_ARGENTINO";
    }

    @Override
    public boolean isConfigured(CarrierConfig config) {
        return config.getApiUsername() != null && !config.getApiUsername().isBlank()
            && config.getApiPassword() != null && !config.getApiPassword().isBlank()
            && config.getApiClientNumber() != null && !config.getApiClientNumber().isBlank();
    }

    /**
     * TODO: Replace stub with real Correo Argentino REST call:
     *   1. Obtain OAuth2 token (POST /v1/oauth/token)
     *   2. GET /v3/tarifas?cpOrigen=B1778&cpDestino=destination&peso=...
     *   3. Parse JSON response → map to ShippingOptionResponse list
     */
    @Override
    public List<ShippingOptionResponse> calculateRates(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config) {

        log.warn("Correo Argentino API integration not yet implemented — no rates returned");
        return List.of();
    }
}
