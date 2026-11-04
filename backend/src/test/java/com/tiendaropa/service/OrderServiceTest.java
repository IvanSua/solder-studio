package com.tiendaropa.service;

import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock ProductVariantRepository variantRepository;
    @Mock StorageService storageService;
    @Mock EmailService emailService;
    @Mock PointsService pointsService;
    @Mock NotificationService notificationService;
    @Mock BusinessMetricsService metrics;
    @InjectMocks OrderService orderService;

    private User user;
    private Product product;
    private ProductVariant variant;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("S")
                .passwordHash("hash")
                .build();

        product = Product.builder()
                .id(1L).name("Remera Negra").slug("remera-negra")
                .images(new ArrayList<>())
                .build();

        variant = ProductVariant.builder()
                .id(10L).product(product)
                .priceAmount(5000L).currencyCode("ARS")
                .color("Negro").size("M")
                .stockReserved(2)
                .build();
    }

    private Order buildOrder(OrderStatus status) {
        Order order = Order.builder()
                .id(100L).user(user).status(status)
                .subtotalAmount(10000L).discountAmount(0L)
                .taxAmount(0L).shippingAmount(0L).totalAmount(10000L)
                .currencyCode("ARS").paymentMethod("TRANSFER")
                .build();
        return order;
    }

    private OrderItem buildOrderItem(Order order, int qty) {
        return OrderItem.builder()
                .id(1L).order(order).productVariant(variant)
                .quantity(qty).unitPriceAmount(5000L).currencyCode("ARS")
                .productName("Remera Negra").variantColor("Negro").variantSize("M")
                .build();
    }

    // ─── getOrder ─────────────────────────────────────────────────────────────

    @Nested
    class GetOrder {

        @Test
        void existingOrder_returnsOrderResponse() {
            Order order = buildOrder(OrderStatus.PENDING);

            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));

            OrderResponse response = orderService.getOrder(1L, 100L);

            assertThat(response.getOrderId()).isEqualTo(100L);
            assertThat(response.getStatus()).isEqualTo("pending");
            assertThat(response.getAmounts().getTotal()).isEqualTo(10000L);
        }

        @Test
        void orderNotFound_throwsResourceNotFoundException() {
            when(orderRepository.findByIdAndUserId(999L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.getOrder(1L, 999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order not found");
        }
    }

    // ─── cancelOrder ─────────────────────────────────────────────────────────

    @Nested
    class CancelOrder {

        @Test
        void pendingOrder_cancelledSuccessfully() {
            Order order = buildOrder(OrderStatus.PENDING);
            OrderItem item = buildOrderItem(order, 2);
            order.getItems().add(item);

            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            OrderResponse response = orderService.cancelOrder(1L, 100L);

            assertThat(response.getStatus()).isEqualTo("cancelled");
        }

        @Test
        void awaitingPaymentOrder_cancelledSuccessfully() {
            Order order = buildOrder(OrderStatus.AWAITING_PAYMENT);
            OrderItem item = buildOrderItem(order, 2);
            order.getItems().add(item);

            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            OrderResponse response = orderService.cancelOrder(1L, 100L);

            assertThat(response.getStatus()).isEqualTo("cancelled");
        }

        @Test
        void shippedOrder_throwsBusinessException() {
            Order order = buildOrder(OrderStatus.SHIPPED);

            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));

            assertThatThrownBy(() -> orderService.cancelOrder(1L, 100L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Order cannot be cancelled in status: SHIPPED");
        }

        @Test
        void deliveredOrder_throwsBusinessException() {
            Order order = buildOrder(OrderStatus.DELIVERED);

            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));

            assertThatThrownBy(() -> orderService.cancelOrder(1L, 100L))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void cancellation_releasesReservedStock() {
            Order order = buildOrder(OrderStatus.PENDING);
            OrderItem item = buildOrderItem(order, 2);
            order.getItems().add(item);

            // Variant has 2 reserved units
            when(orderRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.cancelOrder(1L, 100L);

            // stockReserved should be decremented by 2 (the item qty)
            assertThat(variant.getStockReserved()).isEqualTo(0);
            verify(variantRepository).save(variant);
        }

        @Test
        void orderNotFound_throwsResourceNotFoundException() {
            when(orderRepository.findByIdAndUserId(999L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.cancelOrder(1L, 999L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ─── updateOrderStatus ────────────────────────────────────────────────────

    @Nested
    class UpdateOrderStatus {

        @Test
        void updateToShipped_sendsEmailAndNotification() {
            Order order = buildOrder(OrderStatus.PAID);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateOrderStatus(100L, OrderStatus.SHIPPED);

            verify(emailService).sendOrderStatusUpdate(eq(100L), eq("shipped"), eq("ivan@test.com"), eq("Ivan"));
            verify(notificationService).createAsync(
                    eq(1L),
                    eq(NotificationType.ORDER_SHIPPED),
                    anyString(), anyString(), anyString());
        }

        @Test
        void updateToDelivered_awardsLoyaltyPoints() {
            Order order = buildOrder(OrderStatus.PAID);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateOrderStatus(100L, OrderStatus.DELIVERED);

            // 1 pt per $100 → 10000 centavos = 100 pesos → 1 point
            verify(pointsService).awardOrderPoints(eq(1L), eq(100L), eq(10000L));
        }

        @Test
        void updateToNonDelivered_doesNotAwardPoints() {
            Order order = buildOrder(OrderStatus.PAID);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateOrderStatus(100L, OrderStatus.PREPARING);

            verifyNoInteractions(pointsService);
        }

        @Test
        void orderNotFound_throwsResourceNotFoundException() {
            when(orderRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.updateOrderStatus(999L, OrderStatus.SHIPPED))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void statusUpdatedAndPersisted() {
            Order order = buildOrder(OrderStatus.PAID);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateOrderStatus(100L, OrderStatus.PREPARING);

            assertThat(order.getStatus()).isEqualTo(OrderStatus.PREPARING);
            verify(orderRepository).save(order);
        }
    }

    // ─── refundOrder ─────────────────────────────────────────────────────────

    @Nested
    class RefundOrder {

        @Test
        void deliveredOrder_refundedSuccessfully() {
            Order order = buildOrder(OrderStatus.DELIVERED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            OrderResponse response = orderService.refundOrder(100L);

            assertThat(response.getStatus()).isEqualTo("refunded");
            verify(emailService).sendOrderStatusUpdate(eq(100L), eq("refunded"), anyString(), anyString());
        }

        @Test
        void paidOrder_refundedSuccessfully() {
            Order order = buildOrder(OrderStatus.PAID);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            OrderResponse response = orderService.refundOrder(100L);

            assertThat(response.getStatus()).isEqualTo("refunded");
        }

        @Test
        void pendingOrder_throwsBusinessException() {
            Order order = buildOrder(OrderStatus.PENDING);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));

            assertThatThrownBy(() -> orderService.refundOrder(100L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Only DELIVERED or PAID orders can be refunded");
        }

        @Test
        void cancelledOrder_throwsBusinessException() {
            Order order = buildOrder(OrderStatus.CANCELLED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));

            assertThatThrownBy(() -> orderService.refundOrder(100L))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void refund_sendsRefundedNotification() {
            Order order = buildOrder(OrderStatus.DELIVERED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.refundOrder(100L);

            verify(notificationService).createAsync(
                    eq(1L),
                    eq(NotificationType.ORDER_REFUNDED),
                    anyString(), anyString(), anyString());
        }
    }

    // ─── updateTracking ─────────────────────────────────────────────────────

    @Nested
    class UpdateTracking {

        @Test
        void updateTracking_setsTrackingInfoAndSendsEmail() {
            Order order = buildOrder(OrderStatus.SHIPPED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            OrderResponse response = orderService.updateTracking(100L, "OCA123456789", "https://oca.com.ar/track/OCA123456789");

            assertThat(order.getTrackingNumber()).isEqualTo("OCA123456789");
            assertThat(order.getTrackingUrl()).isEqualTo("https://oca.com.ar/track/OCA123456789");

            verify(emailService).sendTrackingUpdate(
                    eq(100L),
                    eq("OCA123456789"),
                    eq("https://oca.com.ar/track/OCA123456789"),
                    eq("ivan@test.com"),
                    eq("Ivan")
            );
        }

        @Test
        void updateTracking_withoutNumber_sendsNoEmail() {
            Order order = buildOrder(OrderStatus.SHIPPED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateTracking(100L, null, null);

            verify(emailService, never()).sendTrackingUpdate(anyLong(), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        void updateTracking_blankNumber_sendsNoEmail() {
            Order order = buildOrder(OrderStatus.SHIPPED);

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateTracking(100L, "  ", "https://example.com");

            verify(emailService, never()).sendTrackingUpdate(anyLong(), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        void updateTracking_orderNotFound_throwsException() {
            when(orderRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.updateTracking(999L, "OCA123", "https://oca.com"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order not found");
        }

        @Test
        void updateTracking_clearsTrackingInfo() {
            Order order = buildOrder(OrderStatus.SHIPPED);
            order.setTrackingNumber("OCA123456789");
            order.setTrackingUrl("https://oca.com");

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateTracking(100L, null, null);

            assertThat(order.getTrackingNumber()).isNull();
            assertThat(order.getTrackingUrl()).isNull();
        }

        @Test
        void updateTracking_updatesExistingNumber() {
            Order order = buildOrder(OrderStatus.SHIPPED);
            order.setTrackingNumber("OLD123");

            when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
            when(orderRepository.save(order)).thenReturn(order);

            orderService.updateTracking(100L, "NEW456", "https://new.com");

            assertThat(order.getTrackingNumber()).isEqualTo("NEW456");
            assertThat(order.getTrackingUrl()).isEqualTo("https://new.com");
        }
    }
}
