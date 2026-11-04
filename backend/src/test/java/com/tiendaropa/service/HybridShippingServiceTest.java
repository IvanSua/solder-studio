package com.tiendaropa.service;

import com.tiendaropa.config.properties.ShippingProperties;
import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import com.tiendaropa.enums.CarrierMode;
import com.tiendaropa.repository.CarrierConfigRepository;
import com.tiendaropa.service.carrier.CarrierAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HybridShippingServiceTest {

    @Mock CarrierConfigRepository carrierConfigRepository;
    @Mock ShippingService shippingService;
    @Mock ShippingProperties shippingProperties;
    @Mock CarrierAdapter ocaAdapter;
    @Mock CarrierAdapter andreaniAdapter;

    HybridShippingService hybridShippingService;

    private static final String ORIGIN = "B1778";
    private static final String PROVINCE = "Buenos Aires";
    private static final Long ORDER_AMOUNT = 200000L;

    @BeforeEach
    void setUp() {
        when(shippingProperties.originPostalCode()).thenReturn(ORIGIN);
        when(ocaAdapter.getCarrierCode()).thenReturn("OCA");
        when(andreaniAdapter.getCarrierCode()).thenReturn("ANDREANI");

        hybridShippingService = new HybridShippingService(
                carrierConfigRepository,
                shippingService,
                shippingProperties,
                List.of(ocaAdapter, andreaniAdapter)
        );
    }

    private CarrierConfig manualCarrier(String code, String name) {
        return CarrierConfig.builder()
                .carrierCode(code)
                .carrierName(name)
                .mode(CarrierMode.MANUAL)
                .enabled(true)
                .build();
    }

    private CarrierConfig autoCarrier(String code, String name) {
        return CarrierConfig.builder()
                .carrierCode(code)
                .carrierName(name)
                .mode(CarrierMode.AUTO)
                .enabled(true)
                .apiUsername("user")
                .apiPassword("pass")
                .apiClientNumber("123")
                .build();
    }

    private ShippingOptionResponse option(String carrier, long price) {
        return ShippingOptionResponse.builder()
                .carrierName(carrier)
                .priceAmount(price)
                .deliveryDaysMin(3)
                .deliveryDaysMax(5)
                .isFree(false)
                .build();
    }

    // ─── MANUAL mode ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("MANUAL mode")
    class ManualMode {

        @Test
        @DisplayName("delegates to ShippingService.getManualRatesForCarrier")
        void delegatesToShippingService() {
            CarrierConfig oca = manualCarrier("OCA", "OCA e-Pak");
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca));
            when(shippingService.getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of(option("OCA e-Pak", 150000L)));

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCarrierName()).isEqualTo("OCA e-Pak");
            verify(shippingService).getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT);
            verify(ocaAdapter, never()).calculateRates(any(), any(), any());
        }

        @Test
        @DisplayName("returns empty list when no manual rates exist for province")
        void returnsEmptyWhenNoRates() {
            CarrierConfig oca = manualCarrier("OCA", "OCA e-Pak");
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca));
            when(shippingService.getManualRatesForCarrier(any(), any(), any())).thenReturn(List.of());

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            assertThat(result).isEmpty();
        }
    }

    // ─── AUTO mode ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("AUTO mode")
    class AutoMode {

        @Test
        @DisplayName("calls adapter when credentials are configured")
        void callsAdapterWhenConfigured() {
            CarrierConfig oca = autoCarrier("OCA", "OCA e-Pak");
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca));
            when(ocaAdapter.isConfigured(oca)).thenReturn(true);
            when(ocaAdapter.calculateRates(ORIGIN, "1234", oca))
                    .thenReturn(List.of(option("OCA e-Pak", 120000L)));

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, "1234", ORDER_AMOUNT);

            assertThat(result).hasSize(1);
            verify(ocaAdapter).calculateRates(ORIGIN, "1234", oca);
            verify(shippingService, never()).getManualRatesForCarrier(any(), any(), any());
        }

        @Test
        @DisplayName("falls back to MANUAL when credentials are missing")
        void fallsBackToManualWhenNotConfigured() {
            CarrierConfig oca = autoCarrier("OCA", "OCA e-Pak");
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca));
            when(ocaAdapter.isConfigured(oca)).thenReturn(false);
            when(shippingService.getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of(option("OCA e-Pak", 150000L)));

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, "1234", ORDER_AMOUNT);

            assertThat(result).hasSize(1);
            verify(ocaAdapter, never()).calculateRates(any(), any(), any());
            verify(shippingService).getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT);
        }

        @Test
        @DisplayName("uses province as destination when postalCode is null")
        void usesProvinceWhenPostalCodeIsNull() {
            CarrierConfig oca = autoCarrier("OCA", "OCA e-Pak");
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca));
            when(ocaAdapter.isConfigured(oca)).thenReturn(true);
            when(ocaAdapter.calculateRates(eq(ORIGIN), eq(PROVINCE), eq(oca))).thenReturn(List.of());

            hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            verify(ocaAdapter).calculateRates(ORIGIN, PROVINCE, oca);
        }

        @Test
        @DisplayName("falls back to MANUAL when no adapter exists for carrier code")
        void fallsBackWhenAdapterMissing() {
            CarrierConfig unknown = CarrierConfig.builder()
                    .carrierCode("UNKNOWN_CARRIER")
                    .carrierName("Unknown")
                    .mode(CarrierMode.AUTO)
                    .enabled(true)
                    .build();
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(unknown));
            when(shippingService.getManualRatesForCarrier("Unknown", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of());

            hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            verify(shippingService).getManualRatesForCarrier("Unknown", PROVINCE, ORDER_AMOUNT);
        }
    }

    // ─── Multi-carrier aggregation ────────────────────────────────────────────

    @Nested
    @DisplayName("Multi-carrier aggregation")
    class MultiCarrier {

        @Test
        @DisplayName("merges results from multiple carriers sorted by price")
        void mergesAndSortsByPrice() {
            CarrierConfig oca = manualCarrier("OCA", "OCA e-Pak");
            CarrierConfig andreani = manualCarrier("ANDREANI", "Andreani");

            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca, andreani));
            when(shippingService.getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of(option("OCA e-Pak", 200000L)));
            when(shippingService.getManualRatesForCarrier("Andreani", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of(option("Andreani", 100000L)));

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getPriceAmount()).isEqualTo(100000L);
            assertThat(result.get(1).getPriceAmount()).isEqualTo(200000L);
        }

        @Test
        @DisplayName("skips carrier that throws exception — does not crash")
        void skipsCarrierOnException() {
            CarrierConfig oca = manualCarrier("OCA", "OCA e-Pak");
            CarrierConfig andreani = manualCarrier("ANDREANI", "Andreani");

            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of(oca, andreani));
            when(shippingService.getManualRatesForCarrier("OCA e-Pak", PROVINCE, ORDER_AMOUNT))
                    .thenThrow(new RuntimeException("DB unavailable"));
            when(shippingService.getManualRatesForCarrier("Andreani", PROVINCE, ORDER_AMOUNT))
                    .thenReturn(List.of(option("Andreani", 100000L)));

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            // OCA failed — only Andreani result returned
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCarrierName()).isEqualTo("Andreani");
        }

        @Test
        @DisplayName("returns empty list when no carriers are enabled")
        void returnsEmptyWhenNoEnabledCarriers() {
            when(carrierConfigRepository.findByEnabledTrue()).thenReturn(List.of());

            List<ShippingOptionResponse> result =
                    hybridShippingService.calculateShipping(PROVINCE, null, ORDER_AMOUNT);

            assertThat(result).isEmpty();
            verifyNoInteractions(shippingService);
        }
    }
}
