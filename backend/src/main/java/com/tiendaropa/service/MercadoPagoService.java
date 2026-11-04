package com.tiendaropa.service;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentRefundClient;
import com.mercadopago.client.preference.PreferenceBackUrlsRequest;
import com.mercadopago.client.preference.PreferenceClient;
import com.mercadopago.client.preference.PreferenceItemRequest;
import com.mercadopago.client.preference.PreferenceRequest;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.payment.Payment;
import com.mercadopago.resources.preference.Preference;
import com.tiendaropa.config.MercadoPagoConfig;
import com.tiendaropa.config.properties.ApplicationProperties;
import com.tiendaropa.config.properties.MercadoPagoProperties;
import com.tiendaropa.entity.Cart;
import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MercadoPagoService {

    private final MercadoPagoConfig mpConfig;
    private final MercadoPagoProperties mpProperties;
    private final ApplicationProperties appProperties;

    /**
     * Creates a Checkout Pro preference and returns the init_point URL.
     * If MP is not configured, returns a placeholder URL so the app still works
     * end-to-end (the user just won't reach a real payment page).
     */
    @CircuitBreaker(name = "mercadopago", fallbackMethod = "createPreferenceFallback")
    public String createPreference(Order order, Cart cart, @SuppressWarnings("unused") User user) {
        if (!mpConfig.isConfigured()) {
            log.warn("MP not configured — returning placeholder URL for order {}", order.getId());
            return appProperties.frontendUrl() + "/orders/" + order.getId() + "?notice=mp_not_configured";
        }

        try {
            PreferenceClient client = new PreferenceClient();

            List<PreferenceItemRequest> items = cart.getItems().stream()
                    .map(item -> PreferenceItemRequest.builder()
                            .id(String.valueOf(item.getProductVariant().getId()))
                            .title(item.getProductVariant().getProduct().getName()
                                   + " (" + item.getProductVariant().getColor()
                                   + " / " + item.getProductVariant().getSize() + ")")
                            .quantity(item.getQuantity())
                            .unitPrice(BigDecimal.valueOf(
                                    item.getProductVariant().getPriceAmount(), 2))
                            .currencyId("ARS")
                            .build())
                    .toList();

            PreferenceRequest.PreferenceRequestBuilder builder = PreferenceRequest.builder()
                    .items(items)
                    .externalReference(order.getId().toString());

            // back_urls and autoReturn — only add when running with a valid public URL
            // (localhost is accepted by MP sandbox, but some policies may reject it)
            if (appProperties.frontendUrl() != null && !appProperties.frontendUrl().contains("localhost")) {
                PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                        .success(appProperties.frontendUrl() + "/orders?payment=success")
                        .failure(appProperties.frontendUrl() + "/checkout?payment=failed")
                        .pending(appProperties.frontendUrl() + "/orders?payment=pending")
                        .build();
                builder.backUrls(backUrls).autoReturn("approved");
            }

            if (mpProperties.notificationUrl() != null && !mpProperties.notificationUrl().isBlank()) {
                builder.notificationUrl(mpProperties.notificationUrl());
            }

            Preference preference = client.create(builder.build());

            log.info("MP preference created: {} for order {}", preference.getId(), order.getId());

            // sandbox_init_point for TEST tokens, init_point for production
            boolean isSandbox = mpConfig.isSandbox();
            return isSandbox ? preference.getSandboxInitPoint() : preference.getInitPoint();

        } catch (MPApiException e) {
            log.error("MP API error creating preference for order {}: HTTP {} — {}",
                    order.getId(), e.getStatusCode(), e.getApiResponse().getContent());
            String detail = "MP HTTP " + e.getStatusCode();
            if (e.getStatusCode() == 401) {
                detail = "Token de MercadoPago inválido o no configurado (401)";
            } else if (e.getStatusCode() == 400) {
                detail = "Datos inválidos en la preferencia de pago (400): " + e.getApiResponse().getContent();
            }
            throw new BusinessException("Error al crear el pago: " + detail, HttpStatus.BAD_GATEWAY);
        } catch (MPException e) {
            log.error("MP SDK error creating preference for order {}: {}", order.getId(), e.getMessage());
            throw new BusinessException("Error de conexión con MercadoPago: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * Creates a Checkout Pro preference for a gift card purchase and returns the
     * init_point URL. Mirrors {@link #createPreference}, but the external
     * reference is prefixed "GC-" so PaymentWebhookService can tell gift-card
     * payments apart from regular order payments when the webhook fires.
     *
     * <p>The gift card is NOT activated here — it stays inactive/unspendable
     * until the webhook confirms an approved payment. See GiftCardService.
     */
    @CircuitBreaker(name = "mercadopago", fallbackMethod = "createGiftCardPreferenceFallback")
    public String createGiftCardPreference(GiftCard giftCard, User user) {
        if (!mpConfig.isConfigured()) {
            log.warn("MP not configured — returning placeholder URL for gift card {}", giftCard.getId());
            return appProperties.frontendUrl() + "/gift-cards?notice=mp_not_configured";
        }

        try {
            PreferenceClient client = new PreferenceClient();

            PreferenceItemRequest item = PreferenceItemRequest.builder()
                    .id("giftcard-" + giftCard.getId())
                    .title("Gift Card Solder Studio — $" + giftCard.getInitialAmount())
                    .quantity(1)
                    .unitPrice(giftCard.getInitialAmount())
                    .currencyId("ARS")
                    .build();

            PreferenceRequest.PreferenceRequestBuilder builder = PreferenceRequest.builder()
                    .items(List.of(item))
                    .externalReference("GC-" + giftCard.getId());

            if (appProperties.frontendUrl() != null && !appProperties.frontendUrl().contains("localhost")) {
                PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                        .success(appProperties.frontendUrl() + "/gift-cards?payment=success")
                        .failure(appProperties.frontendUrl() + "/gift-cards?payment=failed")
                        .pending(appProperties.frontendUrl() + "/gift-cards?payment=pending")
                        .build();
                builder.backUrls(backUrls).autoReturn("approved");
            }

            if (mpProperties.notificationUrl() != null && !mpProperties.notificationUrl().isBlank()) {
                builder.notificationUrl(mpProperties.notificationUrl());
            }

            Preference preference = client.create(builder.build());

            log.info("MP gift card preference created: {} for gift card {}", preference.getId(), giftCard.getId());

            boolean isSandbox = mpConfig.isSandbox();
            return isSandbox ? preference.getSandboxInitPoint() : preference.getInitPoint();

        } catch (MPApiException e) {
            log.error("MP API error creating gift card preference for {}: HTTP {} — {}",
                    giftCard.getId(), e.getStatusCode(), e.getApiResponse().getContent());
            throw new BusinessException("Error al crear el pago de la Gift Card: MP HTTP " + e.getStatusCode(),
                    HttpStatus.BAD_GATEWAY);
        } catch (MPException e) {
            log.error("MP SDK error creating gift card preference for {}: {}", giftCard.getId(), e.getMessage());
            throw new BusinessException("Error de conexión con MercadoPago: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * Fetches a payment from MP API and returns it.
     * Used by the webhook to verify the actual payment status.
     */
    @CircuitBreaker(name = "mercadopago", fallbackMethod = "getPaymentFallback")
    public Payment getPayment(Long paymentId) throws MPException, MPApiException {
        PaymentClient client = new PaymentClient();
        return client.get(paymentId);
    }

    /**
     * Issues a partial refund for a previously approved MP payment.
     *
     * @param paymentExternalId the MP payment ID (stored in Order.paymentExternalId)
     * @param amountCentavos    amount to refund in centavos (ARS minimum unit)
     * @throws BusinessException if MP is not configured or the API call fails
     */
    @CircuitBreaker(name = "mercadopago", fallbackMethod = "createPartialRefundFallback")
    public void createPartialRefund(String paymentExternalId, long amountCentavos) {
        if (!mpConfig.isConfigured()) {
            log.warn("MP not configured — skipping refund for payment {}", paymentExternalId);
            return;
        }
        try {
            long paymentId = Long.parseLong(paymentExternalId);
            // MP amounts are in pesos (2 decimal places), centavos ÷ 100
            BigDecimal amountPesos = BigDecimal.valueOf(amountCentavos, 2);

            PaymentRefundClient client = new PaymentRefundClient();
            client.refund(paymentId, amountPesos);
            log.info("Partial refund of {} ARS issued for MP payment {}", amountPesos, paymentId);
        } catch (NumberFormatException e) {
            throw new BusinessException("Invalid payment ID: " + paymentExternalId, HttpStatus.UNPROCESSABLE_ENTITY);
        } catch (MPApiException e) {
            log.error("MP API error creating refund for payment {}: HTTP {} — {}",
                    paymentExternalId, e.getStatusCode(), e.getApiResponse().getContent());
            throw new BusinessException("Error al procesar el reembolso en MercadoPago: HTTP " + e.getStatusCode(),
                    HttpStatus.BAD_GATEWAY);
        } catch (MPException e) {
            log.error("MP SDK error creating refund for payment {}: {}", paymentExternalId, e.getMessage());
            throw new BusinessException("Error de conexión con MercadoPago: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    // ── Circuit breaker fallbacks ─────────────────────────────────────────────

    private String createPreferenceFallback(Order order, Cart cart, User user, Throwable ex) {
        log.error("MP circuit breaker OPEN — createPreference blocked for order {}. Cause: {}",
                order.getId(), ex.getMessage());
        throw new BusinessException(
                "El servicio de pago no está disponible temporalmente. Intentá de nuevo en unos minutos.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private String createGiftCardPreferenceFallback(GiftCard giftCard, User user, Throwable ex) {
        log.error("MP circuit breaker OPEN — createGiftCardPreference blocked for gift card {}. Cause: {}",
                giftCard.getId(), ex.getMessage());
        throw new BusinessException(
                "El servicio de pago no está disponible temporalmente. Intentá de nuevo en unos minutos.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private Payment getPaymentFallback(Long paymentId, Throwable ex) throws MPException, MPApiException {
        log.error("MP circuit breaker OPEN — getPayment blocked for paymentId {}. Cause: {}",
                paymentId, ex.getMessage());
        throw new BusinessException(
                "No se pudo consultar el estado del pago. Intentá de nuevo en unos minutos.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private void createPartialRefundFallback(String paymentExternalId, long amountCentavos, Throwable ex) {
        log.error("MP circuit breaker OPEN — createPartialRefund blocked for payment {}. Cause: {}",
                paymentExternalId, ex.getMessage());
        throw new BusinessException(
                "No se pudo procesar el reembolso temporalmente. El equipo fue notificado.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    /**
     * Validates the MercadoPago webhook signature.
     *
     * MP sends the header: x-signature → ts=<timestamp>,v1=<hash>
     * The hash is HMAC-SHA256 of "id:<paymentId>;request-id:<requestId>;ts:<timestamp>;"
     *
     * @return true if the signature is valid (or if webhook secret is not configured)
     */
    public boolean validateWebhookSignature(String xSignature, String xRequestId, String dataId) {
        if (mpProperties.webhookSecret() == null || mpProperties.webhookSecret().isBlank()) {
            log.error("MP_WEBHOOK_SECRET not configured — rejecting webhook request. Set the MP_WEBHOOK_SECRET environment variable.");
            return false;
        }
        if (xSignature == null || xRequestId == null || dataId == null) {
            log.warn("Missing MP webhook headers — rejecting request");
            return false;
        }

        try {
            // Parse ts and v1 from "ts=<timestamp>,v1=<hash>"
            String ts = null;
            String v1 = null;
            for (String part : xSignature.split(",")) {
                String[] kv = part.strip().split("=", 2);
                if (kv.length == 2) {
                    if ("ts".equals(kv[0])) ts = kv[1];
                    if ("v1".equals(kv[0])) v1 = kv[1];
                }
            }

            if (ts == null || v1 == null) {
                log.warn("Malformed x-signature header: {}", xSignature);
                return false;
            }

            String message = "id:" + dataId + ";request-id:" + xRequestId + ";ts:" + ts + ";";
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(mpProperties.webhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            String computed = HexFormat.of().formatHex(hash);

            boolean valid = computed.equals(v1);
            if (!valid) {
                log.warn("Webhook signature mismatch. Expected: {} Got: {}", computed, v1);
            }
            return valid;

        } catch (Exception e) {
            log.error("Error validating MP webhook signature", e);
            return false;
        }
    }
}
