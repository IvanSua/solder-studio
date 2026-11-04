package com.tiendaropa.service;

import com.tiendaropa.dto.request.GiftCardPurchaseRequest;
import com.tiendaropa.dto.response.GiftCardResponse;
import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.repository.GiftCardRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GiftCardServiceTest {

    @Mock GiftCardRepository giftCardRepository;
    @Mock UserRepository userRepository;
    @Mock EmailService emailService;
    @Mock MercadoPagoService mercadoPagoService;

    @InjectMocks GiftCardService giftCardService;

    private User buyer;
    private GiftCard activeCard;

    @BeforeEach
    void setUp() {
        // purchaseGiftCard() delegates to doPurchaseGiftCard() via self-injection —
        // same reason/pattern as CheckoutService (see CheckoutServiceTest).
        ReflectionTestUtils.setField(giftCardService, "self", giftCardService);

        buyer = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("S")
                .role(UserRole.CUSTOMER).enabled(true)
                .build();

        activeCard = GiftCard.builder()
                .id(1L).code("ABCD1234")
                .initialAmount(new BigDecimal("5000.00"))
                .remainingAmount(new BigDecimal("5000.00"))
                .currencyCode("ARS")
                .purchasedBy(buyer)
                .expiresAt(Instant.now().plus(365, ChronoUnit.DAYS))
                .active(true)
                .build();
    }

    // ── purchaseGiftCard ──────────────────────────────────────────────────────

    @Nested
    class PurchaseGiftCard {

        @Test
        void compradorExiste_creaGiftCardInactivaYPideCheckoutUrl() {
            // Regression test for the free-gift-card bug: a purchase must NOT be
            // active/spendable until MercadoPago confirms payment, and must return
            // a checkoutUrl the frontend redirects to instead of granting balance.
            GiftCardPurchaseRequest req = new GiftCardPurchaseRequest();
            req.setIdempotencyKey(UUID.randomUUID().toString());
            req.setAmount(new BigDecimal("5000.00"));

            GiftCard pendingCard = GiftCard.builder()
                    .id(1L).code("ABCD1234")
                    .initialAmount(new BigDecimal("5000.00"))
                    .remainingAmount(new BigDecimal("5000.00"))
                    .currencyCode("ARS")
                    .purchasedBy(buyer)
                    .expiresAt(Instant.now().plus(365, ChronoUnit.DAYS))
                    .active(false)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(buyer));
            when(giftCardRepository.save(any(GiftCard.class))).thenReturn(pendingCard);
            when(mercadoPagoService.createGiftCardPreference(any(GiftCard.class), eq(buyer)))
                    .thenReturn("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test");

            GiftCardResponse response = giftCardService.purchaseGiftCard(1L, req);

            assertThat(response.isActive()).isFalse();
            assertThat(response.getCheckoutUrl()).contains("mercadopago");
            // The card is not usable/spendable — and no email is sent — until the
            // webhook confirms payment (see PaymentWebhookService.processGiftCardWebhook).
            verifyNoInteractions(emailService);
        }

        @Test
        void retryConMismaIdempotencyKey_noCreaSegundaTarjeta() {
            GiftCardPurchaseRequest req = new GiftCardPurchaseRequest();
            req.setIdempotencyKey("same-key");
            req.setAmount(new BigDecimal("5000.00"));

            when(giftCardRepository.findByIdempotencyKeyAndPurchasedById("same-key", 1L))
                    .thenReturn(Optional.of(activeCard));

            GiftCardResponse response = giftCardService.purchaseGiftCard(1L, req);

            assertThat(response.getId()).isEqualTo(1L);
            verifyNoInteractions(userRepository, mercadoPagoService);
        }

        @Test
        void compradorNoExiste_lanzaRuntimeException() {
            GiftCardPurchaseRequest req = new GiftCardPurchaseRequest();
            req.setIdempotencyKey(UUID.randomUUID().toString());
            req.setAmount(new BigDecimal("1000.00"));

            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> giftCardService.purchaseGiftCard(999L, req))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("User not found");
        }
    }

    // ── validateGiftCard ──────────────────────────────────────────────────────

    @Nested
    class ValidateGiftCard {

        @Test
        void giftCardValida_retornaResponse() {
            when(giftCardRepository.findByCode("ABCD1234")).thenReturn(Optional.of(activeCard));

            GiftCardResponse response = giftCardService.validateGiftCard("ABCD1234");

            assertThat(response.isUsable()).isTrue();
            assertThat(response.isExpired()).isFalse();
        }

        @Test
        void giftCardNoEncontrada_lanzaRuntimeException() {
            when(giftCardRepository.findByCode("INVALIDO")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> giftCardService.validateGiftCard("INVALIDO"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Gift card not found");
        }

        @Test
        void giftCardInactiva_lanzaRuntimeException() {
            activeCard.setActive(false);
            when(giftCardRepository.findByCode("ABCD1234")).thenReturn(Optional.of(activeCard));

            assertThatThrownBy(() -> giftCardService.validateGiftCard("ABCD1234"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("no longer active");
        }

        @Test
        void giftCardExpirada_lanzaRuntimeException() {
            GiftCard expired = GiftCard.builder()
                    .id(2L).code("EXPIRED1")
                    .initialAmount(new BigDecimal("1000.00"))
                    .remainingAmount(new BigDecimal("1000.00"))
                    .purchasedBy(buyer)
                    .expiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
                    .active(true)
                    .build();

            when(giftCardRepository.findByCode("EXPIRED1")).thenReturn(Optional.of(expired));

            assertThatThrownBy(() -> giftCardService.validateGiftCard("EXPIRED1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("expired");
        }

        @Test
        void giftCardSinSaldo_lanzaRuntimeException() {
            activeCard.setRemainingAmount(BigDecimal.ZERO);
            when(giftCardRepository.findByCode("ABCD1234")).thenReturn(Optional.of(activeCard));

            assertThatThrownBy(() -> giftCardService.validateGiftCard("ABCD1234"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("no remaining balance");
        }
    }

    // ── getUserGiftCards ──────────────────────────────────────────────────────

    @Nested
    class GetUserGiftCards {

        @Test
        void usuarioConGiftCards_retornaLista() {
            when(giftCardRepository.findByPurchasedById(1L)).thenReturn(List.of(activeCard));

            List<GiftCardResponse> cards = giftCardService.getUserGiftCards(1L);

            assertThat(cards).hasSize(1);
            assertThat(cards.get(0).getCode()).isEqualTo("ABCD1234");
        }

        @Test
        void usuarioSinGiftCards_retornaListaVacia() {
            when(giftCardRepository.findByPurchasedById(1L)).thenReturn(List.of());

            List<GiftCardResponse> cards = giftCardService.getUserGiftCards(1L);

            assertThat(cards).isEmpty();
        }
    }

    // ── getUserGiftCardBalance ────────────────────────────────────────────────

    @Nested
    class GetUserGiftCardBalance {

        @Test
        void conSaldoDisponible_retornaBalance() {
            when(giftCardRepository.sumRemainingByUserId(1L)).thenReturn(new BigDecimal("7500.00"));

            BigDecimal balance = giftCardService.getUserGiftCardBalance(1L);

            assertThat(balance).isEqualByComparingTo(new BigDecimal("7500.00"));
        }

        @Test
        void sinGiftCards_retornaCero() {
            when(giftCardRepository.sumRemainingByUserId(1L)).thenReturn(null);

            BigDecimal balance = giftCardService.getUserGiftCardBalance(1L);

            assertThat(balance).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }
}
