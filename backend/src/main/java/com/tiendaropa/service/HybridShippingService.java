package com.tiendaropa.service;

import com.tiendaropa.config.properties.ShippingProperties;
import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import com.tiendaropa.enums.CarrierMode;
import com.tiendaropa.repository.CarrierConfigRepository;
import com.tiendaropa.service.carrier.CarrierAdapter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Hybrid shipping rate calculator.
 *
 * <p>For each enabled carrier, checks the configured mode:
 * <ul>
 *   <li>{@link CarrierMode#MANUAL} — fetches rates from the {@code shipping_rates} DB table.</li>
 *   <li>{@link CarrierMode#AUTO}   — calls the carrier's real-time API via {@link CarrierAdapter}.
 *       Falls back to MANUAL automatically if the carrier is not yet configured (no credentials).</li>
 * </ul>
 *
 * <p>Results from all carriers are merged and sorted by price.
 */
@Service
@Slf4j
public class HybridShippingService {

    private final CarrierConfigRepository carrierConfigRepository;
    private final ShippingService shippingService;
    private final ShippingProperties shippingProperties;
    private final Map<String, CarrierAdapter> adaptersByCode;

    public HybridShippingService(
            CarrierConfigRepository carrierConfigRepository,
            ShippingService shippingService,
            ShippingProperties shippingProperties,
            List<CarrierAdapter> adapters) {

        this.carrierConfigRepository = carrierConfigRepository;
        this.shippingService         = shippingService;
        this.shippingProperties      = shippingProperties;
        this.adaptersByCode          = adapters.stream()
                .collect(Collectors.toMap(CarrierAdapter::getCarrierCode, Function.identity()));
    }

    /**
     * Calculates shipping options for the given destination.
     *
     * @param province    destination province (always required — used for MANUAL lookup)
     * @param postalCode  destination postal code (used for AUTO mode API calls; nullable)
     * @param orderAmount order subtotal in cents (for free-shipping threshold evaluation)
     */
    @Transactional(readOnly = true)
    public List<ShippingOptionResponse> calculateShipping(
            String province,
            String postalCode,
            Long orderAmount) {

        List<CarrierConfig> enabledCarriers = carrierConfigRepository.findByEnabledTrue();
        List<ShippingOptionResponse> results = new ArrayList<>();

        for (CarrierConfig carrier : enabledCarriers) {
            try {
                List<ShippingOptionResponse> options = resolveCarrier(carrier, province, postalCode, orderAmount);
                results.addAll(options);
            } catch (Exception e) {
                log.error("Error calculating rates for carrier {}: {}", carrier.getCarrierCode(), e.getMessage());
                // Non-fatal: continue with other carriers
            }
        }

        return results.stream()
                .sorted(Comparator.comparingLong(ShippingOptionResponse::getPriceAmount))
                .toList();
    }

    private List<ShippingOptionResponse> resolveCarrier(
            CarrierConfig carrier,
            String province,
            String postalCode,
            Long orderAmount) {

        if (carrier.getMode() == CarrierMode.AUTO) {
            CarrierAdapter adapter = adaptersByCode.get(carrier.getCarrierCode());

            if (adapter != null && adapter.isConfigured(carrier)) {
                String destination = postalCode != null ? postalCode : province;
                log.debug("AUTO mode: calling {} API for destination {}", carrier.getCarrierCode(), destination);
                return adapter.calculateRates(shippingProperties.originPostalCode(), destination, carrier);
            }

            // AUTO selected but credentials missing → fall back to MANUAL silently
            log.debug("AUTO mode for {} but not configured — falling back to MANUAL", carrier.getCarrierCode());
        }

        // MANUAL: filter the DB rates table by province and carrier name
        return shippingService.getManualRatesForCarrier(carrier.getCarrierName(), province, orderAmount);
    }
}
