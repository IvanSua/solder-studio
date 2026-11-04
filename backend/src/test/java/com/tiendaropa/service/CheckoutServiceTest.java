package com.tiendaropa.service;

import com.tiendaropa.dto.request.CheckoutRequest;
import com.tiendaropa.dto.response.CheckoutResponse;
import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.config.properties.CheckoutProperties;
import com.tiendaropa.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckoutServiceTest {

    @Mock CartRepository cartRepository;
    @Mock OrderRepository orderRepository;
    @Mock AddressRepository addressRepository;
    @Mock UserRepository userRepository;
    @Mock StockService stockService;
    @Mock MercadoPagoService mercadoPagoService;
    @Mock PromotionService promotionService;
    @Mock BusinessMetricsService metrics;
    @Mock CheckoutProperties checkoutProperties;
    @InjectMocks CheckoutService checkoutService;

    private User user;
    private Address address;
    private Cart cart;
    private ProductVariant variant;
    private Product product;

    @BeforeEach
    void setUp() {
        // checkout() delegates to the @Transactional doCheckout() via self-injection
        // (see CheckoutService — same pattern as ProductService/KI-001). Mockito's
        // @InjectMocks has no mock to wire into that field, so it stays null unless
        // set explicitly here.
        ReflectionTestUtils.setField(checkoutService, "self", checkoutService);
        when(checkoutProperties.reservationExpiryMinutes()).thenReturn(15);

        user = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("S")
                .passwordHash("hash")
                .build();

        address = Address.builder()
                .id(1L).user(user)
                .street("Av. Corrientes 1234").city("CABA")
                .province("Buenos Aires").postalCode("1043")
                .build();

        product = Product.builder()
                .id(1L).name("Remera Negra").slug("remera-negra")
                .images(new ArrayList<>())
                .build();

        variant = ProductVariant.builder()
                .id(10L).product(product)
                .priceAmount(5000L).currencyCode("ARS")
                .color("Negro").size("M")
                .build();

        cart = Cart.builder().id(1L).user(user).build();
        CartItem item = CartItem.builder().id(1L).cart(cart).productVariant(variant).quantity(2).build();
        cart.getItems().add(item);
    }

    private CheckoutRequest buildRequest(String paymentMethod) {
        CheckoutRequest req = new CheckoutRequest();
        req.setIdempotencyKey(UUID.randomUUID().toString());
        req.setShippingAddressId(1L);
        req.setPaymentMethod(paymentMethod);
        req.setInstallments(1);
        return req;
    }

    private Order savedOrder() {
        return Order.builder()
                .id(100L).user(user)
                .status(OrderStatus.AWAITING_PAYMENT)
                .shippingAddress(address)
                .subtotalAmount(10000L).discountAmount(0L)
                .taxAmount(0L).shippingAmount(0L).totalAmount(10000L)
                .currencyCode("ARS").paymentMethod("TRANSFER")
                .items(new ArrayList<>())
                // @CreationTimestamp only populates this on a real JPA persist; tests
                // build the entity by hand, so set it explicitly — buildResponseFromExistingOrder
                // (the idempotency retry/race path) reads it to compute reservationExpiresAt.
                .createdAt(java.time.Instant.now())
                .build();
    }

    // ─── Validations ──────────────────────────────────────────────────────────

    @Nested
    class Validations {

        @Test
        void cartNotFound_throwsResourceNotFoundException() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> checkoutService.checkout(1L, buildRequest("TRANSFER")))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Cart not found");
        }

        @Test
        void emptyCart_throwsBusinessException() {
            Cart emptyCart = Cart.builder().id(1L).user(user).build();
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));

            assertThatThrownBy(() -> checkoutService.checkout(1L, buildRequest("TRANSFER")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Cart is empty");
        }

        @Test
        void addressNotFound_throwsResourceNotFoundException() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> checkoutService.checkout(1L, buildRequest("TRANSFER")))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Shipping address not found");
        }

        @Test
        void userNotFound_throwsResourceNotFoundException() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> checkoutService.checkout(1L, buildRequest("TRANSFER")))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User not found");
        }

        @Test
        void invalidCoupon_throwsBusinessException() {
            CheckoutRequest req = buildRequest("TRANSFER");
            req.setCouponCode("INVALID");

            CouponValidationResponse invalidCoupon = CouponValidationResponse.builder()
                    .valid(false).message("Cupón expirado").discountAmount(0L).build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(promotionService.validateCoupon(eq("INVALID"), anyLong())).thenReturn(invalidCoupon);

            assertThatThrownBy(() -> checkoutService.checkout(1L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Cupón inválido");
        }
    }

    // ─── Order creation ───────────────────────────────────────────────────────

    @Nested
    class OrderCreation {

        @Test
        void transferPayment_createsOrderWithCorrectSubtotal() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);

            CheckoutResponse response = checkoutService.checkout(1L, buildRequest("TRANSFER"));

            // subtotal = 5000 * 2 = 10000
            assertThat(response.getAmounts().getSubtotal()).isEqualTo(10000L);
            assertThat(response.getAmounts().getDiscount()).isZero();
            assertThat(response.getAmounts().getTotal()).isEqualTo(10000L);
        }

        @Test
        void transferPayment_doesNotCallMercadoPago() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);

            checkoutService.checkout(1L, buildRequest("TRANSFER"));

            verifyNoInteractions(mercadoPagoService);
        }

        @Test
        void cashPayment_doesNotCallMercadoPago() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);

            checkoutService.checkout(1L, buildRequest("CASH"));

            verifyNoInteractions(mercadoPagoService);
        }

        @Test
        void mercadoPagoPayment_callsMercadoPagoAndReturnsCheckoutUrl() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);
            when(mercadoPagoService.createPreference(any(), any(), any()))
                    .thenReturn("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-pref-id");

            CheckoutResponse response = checkoutService.checkout(1L, buildRequest("MERCADOPAGO"));

            verify(mercadoPagoService).createPreference(any(), any(), any());
            assertThat(response.getPaymentSession().getCheckoutUrl()).contains("mercadopago");
        }

        @Test
        void withValidCoupon_appliesDiscountToTotal() {
            CheckoutRequest req = buildRequest("TRANSFER");
            req.setCouponCode("PROMO10");

            // 10% off — discount = 1000 over a 10000 subtotal
            CouponValidationResponse validCoupon = CouponValidationResponse.builder()
                    .valid(true).message("OK").discountAmount(1000L).build();

            Order orderWithDiscount = Order.builder()
                    .id(100L).user(user).status(OrderStatus.AWAITING_PAYMENT)
                    .shippingAddress(address)
                    .subtotalAmount(10000L).discountAmount(1000L)
                    .taxAmount(0L).shippingAmount(0L).totalAmount(9000L)
                    .currencyCode("ARS").paymentMethod("TRANSFER")
                    .items(new ArrayList<>())
                    .build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(promotionService.validateCoupon(eq("PROMO10"), eq(10000L))).thenReturn(validCoupon);
            when(orderRepository.save(any(Order.class))).thenReturn(orderWithDiscount);

            CheckoutResponse response = checkoutService.checkout(1L, req);

            assertThat(response.getAmounts().getDiscount()).isEqualTo(1000L);
            assertThat(response.getAmounts().getTotal()).isEqualTo(9000L);
            assertThat(response.getCouponApplied()).isEqualTo("PROMO10");
        }

        @Test
        void checkout_reservesStockForEachItem() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);

            checkoutService.checkout(1L, buildRequest("TRANSFER"));

            verify(stockService).reserveStock(eq(10L), eq(2), eq(user), any(Order.class));
        }

        @Test
        void checkout_returnsOrderIdAndExpiresAt() {
            Order order = savedOrder();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepository.save(any(Order.class))).thenReturn(order);

            CheckoutResponse response = checkoutService.checkout(1L, buildRequest("TRANSFER"));

            assertThat(response.getOrderId()).isEqualTo(100L);
            assertThat(response.getReservationExpiresAt()).isNotNull();
        }
    }

    // ─── Idempotency (duplicate-checkout protection) ─────────────────────────

    @Nested
    class Idempotency {

        @Test
        void retryWithSameKey_returnsExistingOrder_withoutTouchingStockOrCart() {
            CheckoutRequest req = buildRequest("TRANSFER");
            Order existing = savedOrder();
            existing.setIdempotencyKey(req.getIdempotencyKey());

            when(orderRepository.findByIdempotencyKeyAndUserId(req.getIdempotencyKey(), 1L))
                    .thenReturn(Optional.of(existing));

            CheckoutResponse response = checkoutService.checkout(1L, req);

            assertThat(response.getOrderId()).isEqualTo(100L);
            // The fast path must short-circuit before ever touching the cart/stock/MP —
            // otherwise a retry would still reserve stock or hit MercadoPago twice.
            verifyNoInteractions(cartRepository, stockService, mercadoPagoService);
        }

        @Test
        void concurrentRaceOnSameKey_returnsWinningOrder_insteadOfPropagatingError() {
            CheckoutRequest req = buildRequest("TRANSFER");

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(cart));
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(address));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            // First lookup (fast path): no order yet — two requests race past this point.
            // The concurrent request's INSERT wins and violates the unique idempotency
            // constraint on this request's save — this is what the DB actually does.
            Order winningOrder = savedOrder();
            winningOrder.setIdempotencyKey(req.getIdempotencyKey());
            when(orderRepository.findByIdempotencyKeyAndUserId(req.getIdempotencyKey(), 1L))
                    .thenReturn(Optional.empty())
                    .thenReturn(Optional.of(winningOrder));
            when(orderRepository.save(any(Order.class)))
                    .thenThrow(new org.springframework.dao.DataIntegrityViolationException("duplicate key value violates unique constraint"));

            CheckoutResponse response = checkoutService.checkout(1L, req);

            assertThat(response.getOrderId()).isEqualTo(100L);
        }
    }
}
