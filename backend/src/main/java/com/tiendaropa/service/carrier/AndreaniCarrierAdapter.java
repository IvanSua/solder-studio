package com.tiendaropa.service.carrier;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Andreani carrier adapter.
 *
 * <p>API: REST — https://apis.andreani.com
 *
 * <p>Required credentials in CarrierConfig:
 * <ul>
 *   <li>{@code apiUsername}     — API username (from Andreani developer portal)</li>
 *   <li>{@code apiPassword}     — API password</li>
 *   <li>{@code apiClientNumber} — Número de cliente Andreani</li>
 * </ul>
 *
 * <p>TODO: Implement REST calls when credentials are available.
 * Endpoint: POST /v1/tarifas with body { cpOrigen, cpDestino, bultos: [{peso, alto, ancho, largo}] }
 */
@Component
@Slf4j
public class AndreaniCarrierAdapter implements CarrierAdapter {

    @Override
    public String getCarrierCode() {
        return "ANDREANI";
    }

    @Override
    public boolean isConfigured(CarrierConfig config) {
        return config.getApiUsername() != null && !config.getApiUsername().isBlank()
            && config.getApiPassword() != null && !config.getApiPassword().isBlank()
            && config.getApiClientNumber() != null && !config.getApiClientNumber().isBlank();
    }

    /**
     * TODO: Replace stub with real Andreani REST call:
     *   1. POST to https://apis.andreani.com/v1/tarifas (Basic Auth)
     *   2. Body: { "cpOrigen": "B1778", "cpDestino": destination, "bultos": [...] }
     *   3. Parse JSON response → map to ShippingOptionResponse list
     */
    @Override
    public List<ShippingOptionResponse> calculateRates(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config) {

        log.warn("Andreani API integration not yet implemented — no rates returned");
        return List.of();
    }
}
