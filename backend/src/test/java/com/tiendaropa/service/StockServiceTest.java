package com.tiendaropa.service;

import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.entity.StockReservation;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.ReservationStatus;
import com.tiendaropa.config.properties.CheckoutProperties;
import com.tiendaropa.exception.InsufficientStockException;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.StockReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StockServiceTest {

    @Mock
    private ProductVariantRepository variantRepository;

    @Mock
    private StockReservationRepository reservationRepository;

    @Mock
    private CheckoutProperties checkoutProperties;

    @InjectMocks
    private StockService stockService;

    @BeforeEach
    void setUp() {
        lenient().when(checkoutProperties.reservationExpiryMinutes()).thenReturn(30);
    }

    private ProductVariant buildVariant(int total, int reserved) {
        return ProductVariant.builder()
                .id(1L)
                .color("Negro")
                .size("M")
                .priceAmount(10000L)
                .stockTotal(total)
                .stockReserved(reserved)
                .build();
    }

    private User buildUser() {
        return User.builder()
                .id(1L)
                .email("cliente@tienda.com")
                .firstName("Ana")
                .lastName("Lopez")
                .passwordHash("hash")
                .build();
    }

    private Order buildOrder() {
        return Order.builder()
                .id(100L)
                .subtotalAmount(10000L)
                .totalAmount(10000L)
                .build();
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class ReserveStock {

        @Test
        void reservaExitosaDecrementaStockDisponible() {
            ProductVariant variant = buildVariant(10, 2); // available = 8
            when(variantRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(variant));
            StockReservation savedReservation = StockReservation.builder()
                    .id(1L)
                    .variant(variant)
                    .user(buildUser())
                    .quantity(3)
                    .status(ReservationStatus.ACTIVE)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();
            when(reservationRepository.save(any(StockReservation.class))).thenReturn(savedReservation);

            StockReservation resultado = stockService.reserveStock(1L, 3, buildUser(), buildOrder());

            assertThat(variant.getStockReserved()).isEqualTo(5);
            verify(variantRepository).save(variant);
            assertThat(resultado.getStatus()).isEqualTo(ReservationStatus.ACTIVE);
        }

        @Test
        void stockInsuficienteLanzaInsufficientStockException() {
            ProductVariant variant = buildVariant(5, 4); // available = 1
            when(variantRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(variant));

            assertThatThrownBy(() -> stockService.reserveStock(1L, 3, buildUser(), buildOrder()))
                    .isInstanceOf(InsufficientStockException.class)
                    .hasMessageContaining("Insufficient stock");

            verify(variantRepository, never()).save(any());
            verify(reservationRepository, never()).save(any());
        }

        @Test
        void varianteNoEncontradaLanzaInsufficientStockException() {
            when(variantRepository.findByIdForUpdate(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stockService.reserveStock(99L, 1, buildUser(), buildOrder()))
                    .isInstanceOf(InsufficientStockException.class)
                    .hasMessageContaining("Variant not found");
        }

        @Test
        void reservacionSeCreaConStatusActivo() {
            ProductVariant variant = buildVariant(10, 0);
            when(variantRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(variant));
            when(reservationRepository.save(any(StockReservation.class))).thenAnswer(inv -> inv.getArgument(0));

            StockReservation resultado = stockService.reserveStock(1L, 2, buildUser(), buildOrder());

            assertThat(resultado.getStatus()).isEqualTo(ReservationStatus.ACTIVE);
            assertThat(resultado.getQuantity()).isEqualTo(2);
            assertThat(resultado.getExpiresAt()).isAfter(Instant.now());
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class ReleaseReservation {

        @Test
        void liberaReservacionActivaIncrementandoStockDisponible() {
            ProductVariant variant = buildVariant(10, 3);
            StockReservation reservation = StockReservation.builder()
                    .id(1L)
                    .variant(variant)
                    .quantity(3)
                    .status(ReservationStatus.ACTIVE)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();
            when(variantRepository.findByIdForUpdate(variant.getId())).thenReturn(Optional.of(variant));

            stockService.releaseReservation(reservation);

            assertThat(variant.getStockReserved()).isEqualTo(0);
            assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
            verify(variantRepository).save(variant);
            verify(reservationRepository).save(reservation);
        }

        @Test
        void noLiberaReservacionYaCancelada() {
            StockReservation reservation = StockReservation.builder()
                    .id(1L)
                    .variant(buildVariant(10, 0))
                    .quantity(3)
                    .status(ReservationStatus.CANCELLED)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();

            stockService.releaseReservation(reservation);

            verify(variantRepository, never()).findByIdForUpdate(any());
            verify(reservationRepository, never()).save(any());
        }

        @Test
        void noLiberaReservacionConsumed() {
            StockReservation reservation = StockReservation.builder()
                    .id(2L)
                    .variant(buildVariant(10, 3))
                    .quantity(3)
                    .status(ReservationStatus.CONSUMED)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();

            stockService.releaseReservation(reservation);

            verify(variantRepository, never()).findByIdForUpdate(any());
            verify(reservationRepository, never()).save(any());
        }

        @Test
        void stockReservedNoBajaDecerodDuranteRelease() {
            ProductVariant variant = buildVariant(10, 1);
            StockReservation reservation = StockReservation.builder()
                    .id(1L)
                    .variant(variant)
                    .quantity(5)
                    .status(ReservationStatus.ACTIVE)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();
            when(variantRepository.findByIdForUpdate(variant.getId())).thenReturn(Optional.of(variant));

            stockService.releaseReservation(reservation);

            assertThat(variant.getStockReserved()).isGreaterThanOrEqualTo(0);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class ConsumeReservation {

        @Test
        void marcaReservacionComoConsumed() {
            StockReservation reservation = StockReservation.builder()
                    .id(1L)
                    .variant(buildVariant(10, 3))
                    .quantity(3)
                    .status(ReservationStatus.ACTIVE)
                    .expiresAt(Instant.now().plusSeconds(1800))
                    .build();

            stockService.consumeReservation(reservation);

            assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONSUMED);
            verify(reservationRepository).save(reservation);
        }
    }
}
