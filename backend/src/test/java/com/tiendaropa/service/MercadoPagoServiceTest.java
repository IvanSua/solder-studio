package com.tiendaropa.service;

import com.tiendaropa.config.MercadoPagoConfig;
import com.tiendaropa.config.properties.ApplicationProperties;
import com.tiendaropa.config.properties.MercadoPagoProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests for MercadoPagoService.
 * Solo cubre la lógica pura (validateWebhookSignature y createPreference sin MP configurado).
 * Los métodos que llaman al SDK de MP (createPreference con token real, getPayment)
 * requieren integración y no se testean aquí.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MercadoPagoServiceTest {

    @Mock
    private MercadoPagoConfig mpConfig;

    @Mock
    private MercadoPagoProperties mpProperties;

    @Mock
    private ApplicationProperties appProperties;

    @InjectMocks
    private MercadoPagoService mercadoPagoService;

    private static final String SECRET = "mi-secreto-de-prueba";
    private static final String DATA_ID = "12345";
    private static final String REQUEST_ID = "req-abc-123";
    private static final String TIMESTAMP = "1700000000";

    @BeforeEach
    void setUp() {
        when(mpProperties.webhookSecret()).thenReturn(SECRET);
        when(mpProperties.notificationUrl()).thenReturn("");
        when(appProperties.frontendUrl()).thenReturn("http://localhost:4200");
    }

    private String generarFirmaValida(String dataId, String requestId, String ts) throws Exception {
        String message = "id:" + dataId + ";request-id:" + requestId + ";ts:" + ts + ";";
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class ValidateWebhookSignature {

        @Test
        void firmaValidaRetornaTrue() throws Exception {
            String v1 = generarFirmaValida(DATA_ID, REQUEST_ID, TIMESTAMP);
            String xSignature = "ts=" + TIMESTAMP + ",v1=" + v1;

            boolean resultado = mercadoPagoService.validateWebhookSignature(xSignature, REQUEST_ID, DATA_ID);

            assertThat(resultado).isTrue();
        }

        @Test
        void firmaIncorrectaRetornaFalse() {
            String xSignature = "ts=" + TIMESTAMP + ",v1=hash-incorrecto";

            boolean resultado = mercadoPagoService.validateWebhookSignature(xSignature, REQUEST_ID, DATA_ID);

            assertThat(resultado).isFalse();
        }

        @Test
        void secretoNoConfiguradoRetornaFalsePorDefecto() {
            when(mpProperties.webhookSecret()).thenReturn("");

            boolean resultado = mercadoPagoService.validateWebhookSignature(
                    "ts=123,v1=cualquier-cosa", REQUEST_ID, DATA_ID);

            assertThat(resultado).isFalse();
        }

        @Test
        void headerNullRetornaFalse() {
            boolean resultado = mercadoPagoService.validateWebhookSignature(null, REQUEST_ID, DATA_ID);

            assertThat(resultado).isFalse();
        }

        @Test
        void xRequestIdNullRetornaFalse() {
            boolean resultado = mercadoPagoService.validateWebhookSignature(
                    "ts=123,v1=hash", null, DATA_ID);

            assertThat(resultado).isFalse();
        }

        @Test
        void dataIdNullRetornaFalse() {
            boolean resultado = mercadoPagoService.validateWebhookSignature(
                    "ts=123,v1=hash", REQUEST_ID, null);

            assertThat(resultado).isFalse();
        }

        @Test
        void headerMalformadoSinTsRetornaFalse() {
            boolean resultado = mercadoPagoService.validateWebhookSignature(
                    "invalido", REQUEST_ID, DATA_ID);

            assertThat(resultado).isFalse();
        }

        @Test
        void headerConFormatoCorrectoConCamposInvertidos() throws Exception {
            String v1 = generarFirmaValida(DATA_ID, REQUEST_ID, TIMESTAMP);
            String xSignature = "v1=" + v1 + ",ts=" + TIMESTAMP;

            boolean resultado = mercadoPagoService.validateWebhookSignature(xSignature, REQUEST_ID, DATA_ID);

            assertThat(resultado).isTrue();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class CreatePreference {

        @Test
        void siMercadoPagoNoEstaConfiguradoRetornaUrlPlaceholder() {
            when(mpConfig.isConfigured()).thenReturn(false);

            com.tiendaropa.entity.Order order = com.tiendaropa.entity.Order.builder()
                    .id(42L)
                    .subtotalAmount(10000L)
                    .totalAmount(10000L)
                    .build();

            com.tiendaropa.entity.Cart cart = com.tiendaropa.entity.Cart.builder()
                    .id(1L)
                    .build();

            com.tiendaropa.entity.User user = com.tiendaropa.entity.User.builder()
                    .id(1L)
                    .email("test@tienda.com")
                    .firstName("Test")
                    .lastName("User")
                    .passwordHash("hash")
                    .build();

            String url = mercadoPagoService.createPreference(order, cart, user);

            assertThat(url).contains("mp_not_configured");
            assertThat(url).contains("42");
        }
    }
}
