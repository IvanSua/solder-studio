package com.tiendaropa.service;

import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.payment.Payment;
import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.PaymentWebhookEvent;
import com.tiendaropa.entity.StockReservation;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.PaymentWebhookEventStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CartRepository;
import com.tiendaropa.repository.GiftCardRepository;
import org.springframework.http.HttpStatus;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.PaymentWebhookEventRepository;
import com.tiendaropa.repository.StockReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Procesa webhooks de MercadoPago.
 * 
 * Garantiza idempotencia: si el mismo paymentExternalId llega dos veces,
 * el segundo webhook se ignora silenciosamente.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentWebhookService {

    private final OrderRepository orderRepository;
    private final StockReservationRepository reservationRepository;
    private final StockService stockService;
    private final CartRepository cartRepository;
    private final MercadoPagoService mercadoPagoService;
    private final EmailService emailService;
    private final PaymentWebhookEventRepository webhookEventRepository;
    private final GiftCardRepository giftCardRepository;

    /** Prefix CheckoutService... er, MercadoPagoService.createGiftCardPreference puts
     *  on the externalReference so this webhook can tell a gift-card payment apart
     *  from a regular order payment (both share the same MP webhook endpoint). */
    private static final String GIFT_CARD_REFERENCE_PREFIX = "GC-";

    /**
     * Procesa un webhook de MercadoPago.
     * 
     * Flujo:
     * 1. Validar tipo de webhook (solo "payment")
     * 2. Validar firma del webhook
     * 3. Verificar idempotencia (si ya fue procesado, ignorar)
     * 4. Obtener payment de MP API
     * 5. Actualizar orden según status del payment
     * 6. Consumir/liberar stock según corresponda
     * 7. Limpiar carrito si payment aprobado
     * 8. Enviar email de confirmación (async)
     * 9. Registrar evento de webhook
     */
    @Transactional
    public void processWebhook(Map<String, Object> payload,
                               String xSignature,
                               String xRequestId) {

        String type = (String) payload.get("type");
        if (!"payment".equals(type)) {
            log.debug("Ignoring webhook type: {}", type);
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) payload.get("data");
        if (data == null) {
            log.warn("Webhook payload has no 'data' field");
            return;
        }

        String dataId = String.valueOf(data.get("id"));

        // ── Validar firma del webhook ────────────────────────────────────────
        if (!mercadoPagoService.validateWebhookSignature(xSignature, xRequestId, dataId)) {
            log.warn("Webhook signature validation failed — possible spoofed request. dataId={}, xRequestId={}", dataId, xRequestId);
            throw new BusinessException("Invalid webhook signature", HttpStatus.UNAUTHORIZED);
        }

        // ── Verificar idempotencia ───────────────────────────────────────────
        if (webhookEventRepository.existsByPaymentExternalId(dataId)) {
            log.info("Duplicate webhook detected for paymentExternalId={} — ignoring", dataId);
            return;
        }

        // ── Registrar evento inicial (PENDING) ──────────────────────────────
        PaymentWebhookEvent webhookEvent = PaymentWebhookEvent.builder()
                .paymentExternalId(dataId)
                .status(PaymentWebhookEventStatus.PENDING)
                .payloadHash(hashPayload(payload))
                .build();
        webhookEvent = webhookEventRepository.save(webhookEvent);

        // ── Obtener payment de MP API ───────────────────────────────────────
        Payment payment;
        try {
            payment = mercadoPagoService.getPayment(Long.parseLong(dataId));
        } catch (MPApiException e) {
            log.error("MP API error fetching payment {}: {} — {}",
                    dataId, e.getStatusCode(), e.getApiResponse().getContent());
            markFailed(webhookEvent, "MP API error: HTTP " + e.getStatusCode());
            return;
        } catch (MPException e) {
            log.error("MP SDK error fetching payment {}: {}", dataId, e.getMessage());
            markFailed(webhookEvent, "MP SDK error: " + e.getMessage());
            return;
        } catch (NumberFormatException e) {
            log.error("Invalid payment dataId: {}", dataId);
            // Not retriable — bad data
            webhookEvent.setStatus(PaymentWebhookEventStatus.PROCESSED);
            webhookEvent.setLastError("Invalid dataId: " + dataId);
            webhookEventRepository.save(webhookEvent);
            return;
        }

        String externalReference = payment.getExternalReference();
        if (externalReference == null || externalReference.isBlank()) {
            log.warn("Payment {} has no externalReference — cannot match order", dataId);
            webhookEvent.setStatus(PaymentWebhookEventStatus.PENDING_PAYMENT);
            webhookEventRepository.save(webhookEvent);
            return;
        }

        if (externalReference.startsWith(GIFT_CARD_REFERENCE_PREFIX)) {
            processGiftCardWebhook(externalReference, payment, webhookEvent);
            return;
        }

        Long orderId;
        try {
            orderId = Long.parseLong(externalReference);
        } catch (NumberFormatException e) {
            log.error("externalReference is not a valid orderId: {}", externalReference);
            return;
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        // Store the real MP payment ID in the order for future reference
        order.setPaymentExternalId(String.valueOf(payment.getId()));

        String status = payment.getStatus();
        log.info("Webhook: payment={} status={} order={}", dataId, status, orderId);

        // ── Actualizar según status del payment ─────────────────────────────
        if ("approved".equals(status)) {
            handleApprovedPayment(order, webhookEvent);

        } else if ("rejected".equals(status) || "cancelled".equals(status)) {
            handleCancelledPayment(order, webhookEvent);

        } else {
            // pending, in_process, authorized — keep AWAITING_PAYMENT
            webhookEvent.setOrderId(order.getId());
            webhookEvent.setStatus(PaymentWebhookEventStatus.PENDING_PAYMENT);
            webhookEvent.setProcessedAt(Instant.now());
            webhookEventRepository.save(webhookEvent);
            orderRepository.save(order);
            log.info("Payment status '{}' for order {} — no action taken", status, orderId);
        }
    }

    /**
     * Maneja un pago aprobado.
     * - Actualiza orden a PAID
     * - Consume reservas de stock
     * - Limpia carrito
     * - Envía email de confirmación
     */
    private void handleApprovedPayment(Order order, PaymentWebhookEvent webhookEvent) {
        order.setStatus(OrderStatus.PAID);
        orderRepository.save(order);

        // Consume all stock reservations
        List<StockReservation> reservations = reservationRepository.findByOrderId(order.getId());
        for (StockReservation reservation : reservations) {
            stockService.consumeReservation(reservation);
        }

        // Clear the user's cart
        cartRepository.findByUserIdWithItems(order.getUser().getId())
                .ifPresent(cart -> {
                    cart.getItems().clear();
                    cartRepository.save(cart);
                });

        // Update webhook event
        webhookEvent.setOrderId(order.getId());
        webhookEvent.setStatus(PaymentWebhookEventStatus.APPROVED);
        webhookEvent.setProcessedAt(Instant.now());
        webhookEventRepository.save(webhookEvent);

        log.info("Payment approved — order {} marked as PAID", order.getId());

        // Send confirmation email asynchronously
        String userEmail = order.getUser().getEmail();
        String userFirstName = order.getUser().getFirstName();
        emailService.sendOrderConfirmation(order, userEmail, userFirstName);
    }

    /**
     * Handles a webhook payment whose externalReference is a gift card purchase
     * ("GC-{id}") rather than an order. Activates the card ONLY on an approved
     * payment — this is the fix for the free-gift-card bug: purchaseGiftCard()
     * creates the card with active=false, and this is the only code path allowed
     * to flip it to true for a customer-purchased card.
     */
    private void processGiftCardWebhook(String externalReference, Payment payment, PaymentWebhookEvent webhookEvent) {
        Long giftCardId;
        try {
            giftCardId = Long.parseLong(externalReference.substring(GIFT_CARD_REFERENCE_PREFIX.length()));
        } catch (NumberFormatException e) {
            log.error("externalReference is not a valid gift card id: {}", externalReference);
            webhookEvent.setStatus(PaymentWebhookEventStatus.PROCESSED);
            webhookEvent.setLastError("Invalid gift card externalReference: " + externalReference);
            webhookEventRepository.save(webhookEvent);
            return;
        }

        com.tiendaropa.entity.GiftCard giftCard = giftCardRepository.findById(giftCardId)
                .orElseThrow(() -> new ResourceNotFoundException("Gift card not found: " + giftCardId));

        giftCard.setPaymentExternalId(String.valueOf(payment.getId()));
        String status = payment.getStatus();
        log.info("Webhook: payment={} status={} giftCard={}", payment.getId(), status, giftCardId);

        if ("approved".equals(status)) {
            giftCard.setActive(true);
            giftCardRepository.save(giftCard);

            webhookEvent.setStatus(PaymentWebhookEventStatus.APPROVED);
            webhookEvent.setProcessedAt(Instant.now());
            webhookEventRepository.save(webhookEvent);

            log.info("Payment approved — gift card {} activated", giftCardId);

            com.tiendaropa.entity.User buyer = giftCard.getPurchasedBy();
            if (buyer != null) {
                emailService.sendGiftCardEmail(giftCard, buyer.getEmail(), buyer.getFirstName());
            }

        } else if ("rejected".equals(status) || "cancelled".equals(status)) {
            // Leave active=false permanently — the card was never spendable.
            giftCardRepository.save(giftCard);
            webhookEvent.setStatus(PaymentWebhookEventStatus.CANCELLED);
            webhookEvent.setProcessedAt(Instant.now());
            webhookEventRepository.save(webhookEvent);
            log.info("Payment cancelled — gift card {} stays inactive", giftCardId);

        } else {
            // pending, in_process, authorized — stays inactive until approved
            giftCardRepository.save(giftCard);
            webhookEvent.setStatus(PaymentWebhookEventStatus.PENDING_PAYMENT);
            webhookEvent.setProcessedAt(Instant.now());
            webhookEventRepository.save(webhookEvent);
            log.info("Payment status '{}' for gift card {} — no action taken", status, giftCardId);
        }
    }

    /**
     * Maneja un pago rechazado o cancelado.
     * - Actualiza orden a CANCELLED
     * - Libera reservas de stock
     */
    private void handleCancelledPayment(Order order, PaymentWebhookEvent webhookEvent) {
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        // Release reserved stock
        List<StockReservation> reservations = reservationRepository.findByOrderId(order.getId());
        for (StockReservation reservation : reservations) {
            stockService.releaseReservation(reservation);
        }

        // Update webhook event
        webhookEvent.setOrderId(order.getId());
        webhookEvent.setStatus(PaymentWebhookEventStatus.CANCELLED);
        webhookEvent.setProcessedAt(Instant.now());
        webhookEventRepository.save(webhookEvent);

        log.info("Payment cancelled — order {} cancelled", order.getId());
    }

    /**
     * Re-procesa un evento fallido.
     * Restablece el estado a PENDING y vuelve a intentar el procesamiento completo.
     * El job de retry es quien decide si llamar este método o descartar el evento.
     */
    @Transactional
    public void retryEvent(PaymentWebhookEvent event) {
        log.info("Reintentando webhook event {} (paymentExternalId={})", event.getId(), event.getPaymentExternalId());

        // Fetch the payment again from MP
        com.mercadopago.resources.payment.Payment payment;
        try {
            payment = mercadoPagoService.getPayment(Long.parseLong(event.getPaymentExternalId()));
        } catch (com.mercadopago.exceptions.MPApiException e) {
            markFailed(event, "Retry MP API error: HTTP " + e.getStatusCode());
            return;
        } catch (com.mercadopago.exceptions.MPException e) {
            markFailed(event, "Retry MP SDK error: " + e.getMessage());
            return;
        }

        String externalReference = payment.getExternalReference();
        if (externalReference == null || externalReference.isBlank()) {
            markFailed(event, "Payment still has no externalReference");
            return;
        }

        if (externalReference.startsWith(GIFT_CARD_REFERENCE_PREFIX)) {
            processGiftCardWebhook(externalReference, payment, event);
            return;
        }

        Long orderId;
        try {
            orderId = Long.parseLong(externalReference);
        } catch (NumberFormatException e) {
            event.setStatus(PaymentWebhookEventStatus.PROCESSED);
            event.setLastError("Invalid externalReference: " + externalReference);
            webhookEventRepository.save(event);
            return;
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            markFailed(event, "Order not found: " + orderId);
            return;
        }

        // Guard: if order is already in a terminal state, mark webhook as processed and skip
        OrderStatus currentStatus = order.getStatus();
        if (currentStatus == OrderStatus.PAID || currentStatus == OrderStatus.CANCELLED
                || currentStatus == OrderStatus.DELIVERED) {
            log.info("Retry skipped — order {} already in terminal status {}", orderId, currentStatus);
            event.setOrderId(orderId);
            event.setStatus(PaymentWebhookEventStatus.PROCESSED);
            event.setProcessedAt(Instant.now());
            webhookEventRepository.save(event);
            return;
        }

        order.setPaymentExternalId(String.valueOf(payment.getId()));
        String status = payment.getStatus();

        if ("approved".equals(status)) {
            handleApprovedPayment(order, event);
        } else if ("rejected".equals(status) || "cancelled".equals(status)) {
            handleCancelledPayment(order, event);
        } else {
            event.setOrderId(order.getId());
            event.setStatus(PaymentWebhookEventStatus.PENDING_PAYMENT);
            event.setProcessedAt(Instant.now());
            webhookEventRepository.save(event);
            orderRepository.save(order);
        }
    }

    /**
     * Marca un evento de webhook como FAILED e incrementa el retry count.
     * Calcula el next_retry_at con backoff exponencial: 5m, 10m, 20m, 40m...
     */
    private void markFailed(PaymentWebhookEvent event, String errorMessage) {
        int retries = event.getRetryCount() == null ? 0 : event.getRetryCount();
        long delayMinutes = (long) Math.pow(2, retries) * 5; // 5, 10, 20, 40 min
        if (delayMinutes > 120) delayMinutes = 120; // cap at 2 hours

        event.setStatus(PaymentWebhookEventStatus.FAILED);
        event.setLastError(errorMessage);
        event.setRetryCount(retries + 1);
        event.setNextRetryAt(Instant.now().plusSeconds(delayMinutes * 60));
        webhookEventRepository.save(event);

        log.warn("Webhook event {} marked FAILED (attempt {}): {}", event.getId(), retries + 1, errorMessage);
    }

    /**
     * Genera un hash SHA-256 del payload para debugging.
     */
    private String hashPayload(Map<String, Object> payload) {
        try {
            String json = payload.toString();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.warn("SHA-256 not available for payload hashing");
            return null;
        }
    }
}
