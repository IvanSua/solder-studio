package com.tiendaropa.service;

import com.tiendaropa.dto.request.ShippingRateRequest;
import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.ShippingRate;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ShippingRateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ShippingService {

    private final ShippingRateRepository shippingRateRepository;

    /**
     * Returns manual DB rates filtered by carrier name AND province.
     * Used by HybridShippingService when a carrier is in MANUAL mode.
     */
    @Transactional(readOnly = true)
    public List<ShippingOptionResponse> getManualRatesForCarrier(
            String carrierName, String province, Long orderAmount) {

        List<ShippingRate> rates = shippingRateRepository
                .findByProvinceIgnoreCaseAndActiveTrue(province)
                .stream()
                .filter(r -> r.getCarrierName().equalsIgnoreCase(carrierName))
                .toList();

        return toOptionResponses(rates, orderAmount);
    }

    @Transactional(readOnly = true)
    public List<ShippingOptionResponse> calculateShipping(String province, Long orderAmount) {
        List<ShippingRate> rates = shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue(province);
        return toOptionResponses(rates, orderAmount);
    }

    private List<ShippingOptionResponse> toOptionResponses(List<ShippingRate> rates, Long orderAmount) {
        return rates.stream()
                .map(rate -> {
                    boolean isFree = rate.getFreeShippingThreshold() != null
                            && orderAmount != null
                            && orderAmount >= rate.getFreeShippingThreshold();
                    return ShippingOptionResponse.builder()
                            .id(rate.getId())
                            .carrierName(rate.getCarrierName())
                            .deliveryDaysMin(rate.getDeliveryDaysMin())
                            .deliveryDaysMax(rate.getDeliveryDaysMax())
                            .priceAmount(isFree ? 0L : rate.getPriceAmount())
                            .isFree(isFree)
                            .build();
                })
                .sorted(Comparator.comparingLong(ShippingOptionResponse::getPriceAmount))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ShippingRate> getAllRates() {
        return shippingRateRepository.findAll();
    }

    public ShippingRate createRate(ShippingRateRequest request) {
        ShippingRate rate = ShippingRate.builder()
                .province(request.getProvince())
                .postalCodePrefix(request.getPostalCodePrefix())
                .carrierName(request.getCarrierName())
                .deliveryDaysMin(request.getDeliveryDaysMin())
                .deliveryDaysMax(request.getDeliveryDaysMax())
                .priceAmount(request.getPriceAmount())
                .freeShippingThreshold(request.getFreeShippingThreshold())
                .build();

        return shippingRateRepository.save(rate);
    }

    public ShippingRate updateRate(Long id, ShippingRateRequest request) {
        ShippingRate rate = shippingRateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shipping rate not found with id: " + id));

        rate.setProvince(request.getProvince());
        rate.setPostalCodePrefix(request.getPostalCodePrefix());
        rate.setCarrierName(request.getCarrierName());
        rate.setDeliveryDaysMin(request.getDeliveryDaysMin());
        rate.setDeliveryDaysMax(request.getDeliveryDaysMax());
        rate.setPriceAmount(request.getPriceAmount());
        rate.setFreeShippingThreshold(request.getFreeShippingThreshold());

        return shippingRateRepository.save(rate);
    }

    public void deleteRate(Long id) {
        ShippingRate rate = shippingRateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shipping rate not found with id: " + id));

        rate.setActive(false);
        shippingRateRepository.save(rate);
        log.info("Shipping rate {} soft-deleted", id);
    }
}
