package com.tiendaropa.service;

import com.tiendaropa.dto.request.ShippingRateRequest;
import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.ShippingRate;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ShippingRateRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShippingServiceTest {

    @Mock ShippingRateRepository shippingRateRepository;

    @InjectMocks ShippingService shippingService;

    // ── calculateShipping ─────────────────────────────────────────────────────

    @Nested
    class CalculateShipping {

        @Test
        void returnsEmptyListWhenNoRatesForProvince() {
            when(shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue("Patagonia"))
                    .thenReturn(List.of());

            List<ShippingOptionResponse> result =
                    shippingService.calculateShipping("Patagonia", 10000L);

            assertThat(result).isEmpty();
        }

        @Test
        void returnsPriceAmountWhenOrderBelowFreeThreshold() {
            ShippingRate rate = ShippingRate.builder()
                    .id(1L)
                    .province("Buenos Aires")
                    .carrierName("OCA")
                    .deliveryDaysMin(3)
                    .deliveryDaysMax(5)
                    .priceAmount(150000L)        // $1500 ARS
                    .freeShippingThreshold(500000L) // free above $5000
                    .build();

            when(shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue("Buenos Aires"))
                    .thenReturn(List.of(rate));

            List<ShippingOptionResponse> result =
                    shippingService.calculateShipping("Buenos Aires", 100000L); // $1000

            assertThat(result).hasSize(1);
            ShippingOptionResponse option = result.get(0);
            assertThat(option.getPriceAmount()).isEqualTo(150000L);
            assertThat(option.isFree()).isFalse();
        }

        @Test
        void returnsZeroPriceWhenOrderMeetsFreeThreshold() {
            ShippingRate rate = ShippingRate.builder()
                    .id(1L)
                    .province("Buenos Aires")
                    .carrierName("Andreani")
                    .deliveryDaysMin(1)
                    .deliveryDaysMax(2)
                    .priceAmount(100000L)
                    .freeShippingThreshold(500000L)
                    .build();

            when(shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue("Buenos Aires"))
                    .thenReturn(List.of(rate));

            List<ShippingOptionResponse> result =
                    shippingService.calculateShipping("Buenos Aires", 500000L); // exactly at threshold

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getPriceAmount()).isZero();
            assertThat(result.get(0).isFree()).isTrue();
        }

        @Test
        void nullFreeShippingThresholdNeverTriggersFreeShipping() {
            ShippingRate rate = ShippingRate.builder()
                    .id(1L)
                    .province("Córdoba")
                    .carrierName("Correo Argentino")
                    .deliveryDaysMin(5)
                    .deliveryDaysMax(10)
                    .priceAmount(200000L)
                    .freeShippingThreshold(null)
                    .build();

            when(shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue("Córdoba"))
                    .thenReturn(List.of(rate));

            List<ShippingOptionResponse> result =
                    shippingService.calculateShipping("Córdoba", 9999999L);

            assertThat(result.get(0).isFree()).isFalse();
            assertThat(result.get(0).getPriceAmount()).isEqualTo(200000L);
        }

        @Test
        void resultSortedByPriceAscending() {
            ShippingRate cheap = ShippingRate.builder().id(1L).province("BA")
                    .carrierName("Cheap").deliveryDaysMin(5).deliveryDaysMax(7)
                    .priceAmount(50000L).build();
            ShippingRate expensive = ShippingRate.builder().id(2L).province("BA")
                    .carrierName("Express").deliveryDaysMin(1).deliveryDaysMax(1)
                    .priceAmount(300000L).build();

            when(shippingRateRepository.findByProvinceIgnoreCaseAndActiveTrue("BA"))
                    .thenReturn(List.of(expensive, cheap));

            List<ShippingOptionResponse> result =
                    shippingService.calculateShipping("BA", 10000L);

            assertThat(result.get(0).getPriceAmount()).isLessThanOrEqualTo(result.get(1).getPriceAmount());
        }
    }

    // ── createRate ────────────────────────────────────────────────────────────

    @Nested
    class CreateRate {

        @Test
        void savesAndReturnsNewRate() {
            ShippingRateRequest req = new ShippingRateRequest();
            req.setProvince("Santa Fe");
            req.setCarrierName("OCA");
            req.setDeliveryDaysMin(2);
            req.setDeliveryDaysMax(4);
            req.setPriceAmount(120000L);

            ShippingRate saved = ShippingRate.builder()
                    .id(10L).province("Santa Fe").carrierName("OCA")
                    .deliveryDaysMin(2).deliveryDaysMax(4).priceAmount(120000L).build();

            when(shippingRateRepository.save(any())).thenReturn(saved);

            ShippingRate result = shippingService.createRate(req);

            assertThat(result.getId()).isEqualTo(10L);
            assertThat(result.getProvince()).isEqualTo("Santa Fe");
            verify(shippingRateRepository).save(any(ShippingRate.class));
        }
    }

    // ── updateRate ────────────────────────────────────────────────────────────

    @Nested
    class UpdateRate {

        @Test
        void throwsWhenRateNotFound() {
            when(shippingRateRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> shippingService.updateRate(99L, new ShippingRateRequest()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void updatesAllFields() {
            ShippingRate existing = ShippingRate.builder()
                    .id(1L).province("Old").carrierName("Old Carrier")
                    .deliveryDaysMin(5).deliveryDaysMax(10).priceAmount(200000L).build();

            ShippingRateRequest req = new ShippingRateRequest();
            req.setProvince("Buenos Aires");
            req.setCarrierName("Andreani");
            req.setDeliveryDaysMin(1);
            req.setDeliveryDaysMax(3);
            req.setPriceAmount(90000L);
            req.setFreeShippingThreshold(500000L);

            when(shippingRateRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(shippingRateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ShippingRate result = shippingService.updateRate(1L, req);

            assertThat(result.getProvince()).isEqualTo("Buenos Aires");
            assertThat(result.getCarrierName()).isEqualTo("Andreani");
            assertThat(result.getPriceAmount()).isEqualTo(90000L);
            assertThat(result.getFreeShippingThreshold()).isEqualTo(500000L);
        }
    }

    // ── deleteRate ────────────────────────────────────────────────────────────

    @Nested
    class DeleteRate {

        @Test
        void softDeletesSetsActiveFalse() {
            ShippingRate rate = ShippingRate.builder()
                    .id(1L).province("Mendoza").carrierName("OCA")
                    .deliveryDaysMin(3).deliveryDaysMax(6).priceAmount(150000L)
                    .active(true).build();

            when(shippingRateRepository.findById(1L)).thenReturn(Optional.of(rate));
            when(shippingRateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            shippingService.deleteRate(1L);

            assertThat(rate.isActive()).isFalse();
            verify(shippingRateRepository).save(rate);
        }

        @Test
        void throwsWhenRateNotFound() {
            when(shippingRateRepository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> shippingService.deleteRate(42L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
