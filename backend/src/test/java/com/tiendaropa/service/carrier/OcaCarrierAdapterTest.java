package com.tiendaropa.service.carrier;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OcaCarrierAdapterTest {

    @Mock
    RestTemplate restTemplate;

    OcaCarrierAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new OcaCarrierAdapter(restTemplate);
    }

    // ─── isConfigured ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("isConfigured")
    class IsConfigured {

        @Test
        @DisplayName("returns true when all four credentials are present")
        void trueWhenAllFieldsPresent() {
            CarrierConfig config = fullyConfigured();
            assertThat(adapter.isConfigured(config)).isTrue();
        }

        @Test
        @DisplayName("returns false when apiUsername is null")
        void falseWhenApiUsernameNull() {
            CarrierConfig config = fullyConfigured();
            config.setApiUsername(null);
            assertThat(adapter.isConfigured(config)).isFalse();
        }

        @Test
        @DisplayName("returns false when apiPassword is blank")
        void falseWhenApiPasswordBlank() {
            CarrierConfig config = fullyConfigured();
            config.setApiPassword("   ");
            assertThat(adapter.isConfigured(config)).isFalse();
        }

        @Test
        @DisplayName("returns false when apiClientNumber is null")
        void falseWhenApiClientNumberNull() {
            CarrierConfig config = fullyConfigured();
            config.setApiClientNumber(null);
            assertThat(adapter.isConfigured(config)).isFalse();
        }

        @Test
        @DisplayName("returns false when apiKey is blank")
        void falseWhenApiKeyBlank() {
            CarrierConfig config = fullyConfigured();
            config.setApiKey("   ");
            assertThat(adapter.isConfigured(config)).isFalse();
        }
    }

    // ─── calculateRates ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("calculateRates")
    class CalculateRates {

        @Test
        @DisplayName("returns two options with correct prices when both SOAP calls succeed")
        void returnsOptionsOnSuccess() {
            CarrierConfig config = fullyConfigured();

            // Primera operativa (64665 — Puerta a Puerta)
            String xmlPuertaPuerta = soapResponse("64665", "Puerta a Puerta", "1250.50", "2");
            // Segunda operativa (62342 — Puerta a Sucursal)
            String xmlPuertaSucursal = soapResponse("62342", "Puerta a Sucursal", "980.00", "3");

            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(xmlPuertaPuerta))
                    .thenReturn(ResponseEntity.ok(xmlPuertaSucursal));

            List<ShippingOptionResponse> result =
                    adapter.calculateRates("B1778", "1000", config);

            assertThat(result).hasSize(2);

            // Verificamos que los precios se convirtieron a centavos correctamente
            ShippingOptionResponse first = result.stream()
                    .filter(r -> r.getCarrierName().contains("Puerta a Puerta"))
                    .findFirst()
                    .orElseThrow();
            assertThat(first.getPriceAmount()).isEqualTo(125050L);
            assertThat(first.getDeliveryDaysMin()).isEqualTo(2);
            assertThat(first.getDeliveryDaysMax()).isEqualTo(3);
            assertThat(first.isFree()).isFalse();
            assertThat(first.getId()).isNull();

            ShippingOptionResponse second = result.stream()
                    .filter(r -> r.getCarrierName().contains("Puerta a Sucursal"))
                    .findFirst()
                    .orElseThrow();
            assertThat(second.getPriceAmount()).isEqualTo(98000L);
            assertThat(second.getDeliveryDaysMin()).isEqualTo(3);
            assertThat(second.getDeliveryDaysMax()).isEqualTo(4);
        }

        @Test
        @DisplayName("returns empty list when RestTemplate throws for every operativa")
        void returnsEmptyOnHttpFailure() {
            CarrierConfig config = fullyConfigured();

            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenThrow(new org.springframework.web.client.HttpServerErrorException(
                            HttpStatus.INTERNAL_SERVER_ERROR, "OCA down"));

            List<ShippingOptionResponse> result =
                    adapter.calculateRates("B1778", "1000", config);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("skips failed operativa and returns the remaining successful one")
        void skipsBadOperativaAndReturnsSucessfulOne() {
            CarrierConfig config = fullyConfigured();

            String xmlOk = soapResponse("62342", "Puerta a Sucursal", "800.00", "2");

            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenThrow(new org.springframework.web.client.ResourceAccessException("timeout"))
                    .thenReturn(ResponseEntity.ok(xmlOk));

            List<ShippingOptionResponse> result =
                    adapter.calculateRates("B1778", "1000", config);

            // Una falla, una exitosa
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getPriceAmount()).isEqualTo(80000L);
        }

        @Test
        @DisplayName("does not throw when response body is null")
        void doesNotThrowOnNullBody() {
            CarrierConfig config = fullyConfigured();

            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<ShippingOptionResponse> result =
                    adapter.calculateRates("B1778", "1000", config);

            assertThat(result).isEmpty();
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private CarrierConfig fullyConfigured() {
        CarrierConfig config = new CarrierConfig();
        config.setApiUsername("test@oca.com.ar");
        config.setApiPassword("123456");
        config.setApiClientNumber("111757/001");
        config.setApiKey("30-53625919-4");
        return config;
    }

    /**
     * Genera un XML SOAP de respuesta OCA mínimo que matchea lo que parsea
     * {@code OcaCarrierAdapter#parseResponse}.
     */
    private String soapResponse(String idOperativa, String descripcion,
                                String precioTotal, String dias) {
        return """
                <?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Body>
                    <Tarifar_Envio_CorporativoResponse xmlns="http://www.oca.com.ar/">
                      <Tarifar_Envio_CorporativoResult>
                        <diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
                          <NewDataSet>
                            <Table>
                              <idOperativa>%s</idOperativa>
                              <Descripcion>%s</Descripcion>
                              <PrecioTotal>%s</PrecioTotal>
                              <Dias>%s</Dias>
                            </Table>
                          </NewDataSet>
                        </diffgr:diffgram>
                      </Tarifar_Envio_CorporativoResult>
                    </Tarifar_Envio_CorporativoResponse>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(idOperativa, descripcion, precioTotal, dias);
    }
}
