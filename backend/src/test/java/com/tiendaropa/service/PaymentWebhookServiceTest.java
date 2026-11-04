package com.tiendaropa.service;

import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.net.MPResponse;
import com.mercadopago.resources.payment.Payment;
import com.tiendaropa.entity.*;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.PaymentWebhookEventStatus;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests para PaymentWebhookService.
 * Following TDD: Tests are written FIRST (RED), then implementation follows (GREEN).
 * 
 * Coverage target: 80%+
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentWebhookServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock StockReservationRepository reservationRepository;
    @Mock StockService stockService;
    @Mock CartRepository cartRepository;
    @Mock MercadoPagoService mercadoPagoService;
    @Mock EmailService emailService;
    @Mock PaymentWebhookEventRepository webhookEventRepository;
    @Mock GiftCardRepository giftCardRepository;
    @InjectMocks PaymentWebhookService webhookService;

    private User user;
    private Order order;
    private Cart cart;
    private StockReservation reservation;
    private Payment mockPayment;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("test@example.com")
                .firstName("Juan")
                .lastName("Pérez")
                .build();

        order = Order.builder()
                .id(100L)
                .user(user)
                .status(OrderStatus.AWAITING_PAYMENT)
                .totalAmount(10000L)
                .build();

        cart = Cart.builder()
                .id(1L)
                .user(user)
                .items(new ArrayList<>())
                .build();

        reservation = StockReservation.builder()
                .id(1L)
                .order(order)
                .user(user)
                .quantity(2)
                .build();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<String, Object> buildWebhookPayload(String type, Long paymentId, String status, Long orderId) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", String.valueOf(paymentId));
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("data", data);
        return payload;
    }

    private void setupMockPaymentApproved(Long paymentId, String externalReference) throws Exception {
        mockPayment = mock(Payment.class);
        when(mockPayment.getId()).thenReturn(paymentId);
        when(mockPayment.getStatus()).thenReturn("approved");
        when(mockPayment.getExternalReference()).thenReturn(externalReference);
        doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);
    }

    private MPResponse mockMPResponse(int statusCode) {
        MPResponse response = mock(MPResponse.class);
        when(response.getStatusCode()).thenReturn(statusCode);
        return response;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-001: Procesamiento de pago aprobado
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-001: Pago aprobado")
    class PagoAprobado {

        @Test
        @DisplayName("WS-001-001: Pago aprobado procesa correctamente")
        void pagoAprobado_procesaCorrectamente() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            // Stub signature validation to return true FIRST
            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            setupMockPaymentApproved(paymentId, "100");
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of(reservation));
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.PAID);

            verify(stockService).consumeReservation(reservation);
            verify(cartRepository).findByUserIdWithItems(1L);
        }

        @Test
        @DisplayName("WS-001-002: Pago aprobado es idempotente")
        void pagoAprobado_idempotente() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            // Signature validation is called BEFORE idempotency check
            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(true);

            webhookService.processWebhook(payload, null, null);

            // validateWebhookSignature IS called, but getPayment is NOT
            verify(mercadoPagoService).validateWebhookSignature(any(), any(), any());
            verify(mercadoPagoService, never()).getPayment(anyLong());
            verify(orderRepository, never()).save(any());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-002: Rechazo y cancelación
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-002: Rechazo y cancelación")
    class RechazoYCancelacion {

        @Test
        @DisplayName("WS-002-001: Pago rechazado procesa correctamente")
        void pagoRechazado_procesaCorrectamente() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "rejected", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("rejected");
            when(mockPayment.getExternalReference()).thenReturn("100");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);

            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of(reservation));
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.CANCELLED);

            verify(stockService).releaseReservation(reservation);
            verify(cartRepository, never()).findByUserIdWithItems(anyLong());
        }

        @Test
        @DisplayName("WS-002-002: Pago cancelado procesa correctamente")
        void pagoCancelado_procesaCorrectamente() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "cancelled", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("cancelled");
            when(mockPayment.getExternalReference()).thenReturn("100");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);

            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of(reservation));
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.CANCELLED);
            verify(stockService).releaseReservation(reservation);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-003: Validación de firma
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-003: Validación de firma")
    class ValidacionFirma {

        @Test
        @DisplayName("WS-003-001: Firma válida es aceptada")
        void firmaValida_esAceptada() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            when(mercadoPagoService.validateWebhookSignature(anyString(), anyString(), anyString())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            setupMockPaymentApproved(paymentId, "100");
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of());
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, "validSig", "req123");

            verify(mercadoPagoService).validateWebhookSignature(anyString(), anyString(), anyString());
            verify(orderRepository, atLeastOnce()).save(any());
        }

        @Test
        @DisplayName("WS-003-002: Firma inválida es rechazada")
        void firmaInvalida_esRechazada() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            when(mercadoPagoService.validateWebhookSignature(anyString(), anyString(), anyString())).thenReturn(false);

            assertThatThrownBy(() -> webhookService.processWebhook(payload, "badSig", "req123"))
                    .isInstanceOf(com.tiendaropa.exception.BusinessException.class);

            verifyNoInteractions(orderRepository);
            verifyNoInteractions(webhookEventRepository);
        }

        @Test
        @DisplayName("WS-003-003: Sin secret es permisivo")
        void sinSecret_esPermisivo() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            setupMockPaymentApproved(paymentId, "100");
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of());
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            verify(orderRepository, atLeastOnce()).save(any());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-004: Estados intermedios
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-004: Estados intermedios")
    class EstadosIntermedios {

        @Test
        @DisplayName("WS-004-001: Pago pendiente no modifica orden")
        void pagoPendiente_noModificaOrden() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "pending", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("pending");
            when(mockPayment.getExternalReference()).thenReturn("100");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);

            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.AWAITING_PAYMENT);

            verify(stockService, never()).consumeReservation(any());
            verify(stockService, never()).releaseReservation(any());
        }

        @Test
        @DisplayName("WS-004-002: Pago en proceso no modifica orden")
        void pagoEnProceso_noModificaOrden() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "in_process", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("in_process");
            when(mockPayment.getExternalReference()).thenReturn("100");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);

            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.AWAITING_PAYMENT);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-005: Manejo de errores
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-005: Manejo de errores")
    class ManejoErrores {

        @Test
        @DisplayName("WS-005-001: Error de API retorna OK")
        void errorDeAPI_retornaOK() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            doThrow(new MPApiException("Error", mockMPResponse(500)))
                    .when(mercadoPagoService).getPayment(paymentId);

            assertThatCode(() -> webhookService.processWebhook(payload, null, null))
                    .doesNotThrowAnyException();

            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("WS-005-002: Payment ID no numérico es manejado")
        void paymentIdNoNumerico_esManejado() throws Exception {
            Map<String, Object> data = new HashMap<>();
            data.put("id", "not-a-number");
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "payment");
            payload.put("data", data);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(any())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(inv -> { PaymentWebhookEvent e = inv.getArgument(0); e.setId(1L); return e; });

            assertThatCode(() -> webhookService.processWebhook(payload, null, null))
                    .doesNotThrowAnyException();

            verifyNoInteractions(orderRepository);
        }

        @Test
        @DisplayName("WS-005-003: Order no encontrada lanza ResourceNotFoundException")
        void orderNoEncontrada_lanzaExcepcion() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 999L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("approved");
            when(mockPayment.getExternalReference()).thenReturn("999");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);

            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            when(orderRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> webhookService.processWebhook(payload, null, null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order not found");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WS-006: Tipo de webhook ignorado
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("WS-006: Tipos de webhook ignorados")
    class TiposIgnorados {

        @Test
        @DisplayName("WS-006-001: Webhook de merchant_order es ignorado")
        void merchantOrder_esIgnorado() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "merchant_order");

            webhookService.processWebhook(payload, null, null);

            verifyNoInteractions(mercadoPagoService);
            verifyNoInteractions(orderRepository);
            verifyNoInteractions(webhookEventRepository);
        }

        @Test
        @DisplayName("WS-006-001: Webhook con type null es ignorado")
        void typeNull_esIgnorado() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", null);

            webhookService.processWebhook(payload, null, null);

            verifyNoInteractions(mercadoPagoService);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IDM-002: Idempotencia
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("IDM-002: Idempotencia")
    class Idempotencia {

        @Test
        @DisplayName("IDM-002-001: Evento nuevo se procesa y registra")
        void eventoNuevo_seProcesaYRegistra() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            setupMockPaymentApproved(paymentId, "100");
            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(reservationRepository.findByOrderId(100L)).thenReturn(List.of());
            when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            verify(webhookEventRepository, atLeastOnce()).save(any(PaymentWebhookEvent.class));
        }

        @Test
        @DisplayName("IDM-002-002: Evento duplicado es ignorado")
        void eventoDuplicado_esIgnorado() throws Exception {
            Long paymentId = 1234567890L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", 100L);

            // Signature validation happens BEFORE idempotency check
            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(true);

            webhookService.processWebhook(payload, null, null);

            // Signature validation IS called, but getPayment is NOT
            verify(mercadoPagoService).validateWebhookSignature(any(), any(), any());
            verify(mercadoPagoService, never()).getPayment(anyLong());
            verify(orderRepository, never()).findById(anyLong());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GC-001: Pagos de Gift Card (regression test for the free-gift-card bug —
    // a purchase must only become active/spendable once MP confirms payment)
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("GC-001: Pagos de Gift Card")
    class PagosGiftCard {

        @Test
        @DisplayName("GC-001-001: Pago aprobado activa la gift card y envía el email")
        void pagoAprobado_activaGiftCardYEnviaEmail() throws Exception {
            Long paymentId = 555L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "approved", null);

            GiftCard pendingCard = GiftCard.builder()
                    .id(7L).code("XYZ12345")
                    .purchasedBy(user)
                    .active(false)
                    .build();

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            setupMockPaymentApproved(paymentId, "GC-7");
            when(giftCardRepository.findById(7L)).thenReturn(Optional.of(pendingCard));
            when(giftCardRepository.save(any(GiftCard.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<GiftCard> captor = ArgumentCaptor.forClass(GiftCard.class);
            verify(giftCardRepository, atLeastOnce()).save(captor.capture());
            assertThat(captor.getValue().isActive()).isTrue();
            verify(emailService).sendGiftCardEmail(any(GiftCard.class), eq("test@example.com"), eq("Juan"));
            // Must never touch the order path for a gift-card reference
            verify(orderRepository, never()).findById(anyLong());
        }

        @Test
        @DisplayName("GC-001-002: Pago rechazado deja la gift card inactiva")
        void pagoRechazado_dejaGiftCardInactiva() throws Exception {
            Long paymentId = 556L;
            Map<String, Object> payload = buildWebhookPayload("payment", paymentId, "rejected", null);

            GiftCard pendingCard = GiftCard.builder()
                    .id(8L).code("XYZ99999")
                    .purchasedBy(user)
                    .active(false)
                    .build();

            when(mercadoPagoService.validateWebhookSignature(any(), any(), any())).thenReturn(true);
            when(webhookEventRepository.existsByPaymentExternalId(anyString())).thenReturn(false);
            when(webhookEventRepository.save(any(PaymentWebhookEvent.class)))
                    .thenAnswer(i -> { i.getArgument(0, PaymentWebhookEvent.class).setId(1L); return i.getArgument(0); });
            mockPayment = mock(Payment.class);
            when(mockPayment.getId()).thenReturn(paymentId);
            when(mockPayment.getStatus()).thenReturn("rejected");
            when(mockPayment.getExternalReference()).thenReturn("GC-8");
            doReturn(mockPayment).when(mercadoPagoService).getPayment(paymentId);
            when(giftCardRepository.findById(8L)).thenReturn(Optional.of(pendingCard));
            when(giftCardRepository.save(any(GiftCard.class))).thenAnswer(i -> i.getArgument(0));

            webhookService.processWebhook(payload, null, null);

            ArgumentCaptor<GiftCard> captor = ArgumentCaptor.forClass(GiftCard.class);
            verify(giftCardRepository, atLeastOnce()).save(captor.capture());
            assertThat(captor.getValue().isActive()).isFalse();
            verifyNoInteractions(emailService);
        }
    }
}
