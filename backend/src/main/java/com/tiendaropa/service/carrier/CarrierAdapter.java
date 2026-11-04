package com.tiendaropa.service.carrier;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;

import java.util.List;

/**
 * Strategy interface for carrier-specific shipping rate calculation.
 * Each implementation wraps one carrier's API (OCA, Andreani, Correo Argentino).
 *
 * <p>Implementations must be Spring beans so they are auto-discovered by
 * {@link com.tiendaropa.service.HybridShippingService}.
 */
public interface CarrierAdapter {

    /** Carrier code this adapter handles — must match CarrierConfig.carrierCode. */
    String getCarrierCode();

    /**
     * Returns true when the given config contains all credentials required to
     * call this carrier's API. False = fall back to MANUAL mode automatically.
     */
    boolean isConfigured(CarrierConfig config);

    /**
     * Fetches live shipping options from the carrier's API.
     *
     * @param originPostalCode      sender's postal code (e.g. "B1778")
     * @param destinationPostalCode recipient's postal code
     * @param config                carrier credentials and settings
     * @return list of available shipping options with prices
     */
    List<ShippingOptionResponse> calculateRates(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config
    );
}
