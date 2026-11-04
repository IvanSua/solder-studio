package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreatePromotionRequest;
import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.dto.response.PromotionResponse;
import com.tiendaropa.entity.Promotion;
import com.tiendaropa.enums.PromotionScope;
import com.tiendaropa.enums.PromotionType;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.PromotionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock PromotionRepository promotionRepository;

    @InjectMocks PromotionService promotionService;

    private Promotion activePromo;
    private CreatePromotionRequest validRequest;

    @BeforeEach
    void setUp() {
        activePromo = Promotion.builder()
                .id(1L)
                .name("Descuento Verano")
                .code("VERANO20")
                .scope(PromotionScope.GLOBAL)
                .type(PromotionType.PERCENTAGE)
                .value(2000L)   // 20.00%
                .priority(1)
                .stackable(false)
                .active(true)
                .startsAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .endsAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .build();

        validRequest = new CreatePromotionRequest();
        validRequest.setName("Nueva Promo");
        validRequest.setScope(PromotionScope.GLOBAL);
        validRequest.setType(PromotionType.PERCENTAGE);
        validRequest.setValue(1500L);
        validRequest.setStartsAt(Instant.now());
        validRequest.setEndsAt(Instant.now().plus(7, ChronoUnit.DAYS));
        validRequest.setActive(true);
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Nested
    class Create {

        @Test
        void requestValido_creaPromocion() {
            when(promotionRepository.save(any(Promotion.class))).thenReturn(activePromo);

            PromotionResponse response = promotionService.create(validRequest);

            assertThat(response.getName()).isEqualTo("Descuento Verano");
            verify(promotionRepository).save(any(Promotion.class));
        }

        @Test
        void endsAtAntesDeStartsAt_lanzaBusinessException() {
            validRequest.setStartsAt(Instant.now().plus(1, ChronoUnit.DAYS));
            validRequest.setEndsAt(Instant.now());

            assertThatThrownBy(() -> promotionService.create(validRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("endsAt must be after startsAt");
        }

        @Test
        void codigoDuplicado_lanzaBusinessException() {
            validRequest.setCode("VERANO20");
            when(promotionRepository.findByCodeIgnoreCase("VERANO20")).thenReturn(Optional.of(activePromo));

            assertThatThrownBy(() -> promotionService.create(validRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("VERANO20");
        }

        @Test
        void sinCodigo_creaPromocionSinCoupon() {
            validRequest.setCode(null);
            when(promotionRepository.save(any(Promotion.class))).thenReturn(activePromo);

            assertThatNoException().isThrownBy(() -> promotionService.create(validRequest));
        }
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Nested
    class Delete {

        @Test
        void promoExistente_laDesactiva() {
            when(promotionRepository.findById(1L)).thenReturn(Optional.of(activePromo));
            when(promotionRepository.save(any(Promotion.class))).thenReturn(activePromo);

            promotionService.delete(1L);

            assertThat(activePromo.isActive()).isFalse();
            verify(promotionRepository).save(activePromo);
        }

        @Test
        void promoNoEncontrada_lanzaResourceNotFoundException() {
            when(promotionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> promotionService.delete(999L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ── validateCoupon ────────────────────────────────────────────────────────

    @Nested
    class ValidateCoupon {

        @Test
        void codigoValido_retornaDescuento() {
            when(promotionRepository.findValidByCode(eq("VERANO20"), any(Instant.class)))
                    .thenReturn(Optional.of(activePromo));

            CouponValidationResponse response = promotionService.validateCoupon("VERANO20", 10000L);

            assertThat(response.isValid()).isTrue();
            assertThat(response.getDiscountAmount()).isEqualTo(2000L); // 20% de 10000
        }

        @Test
        void codigoVacio_retornaInvalido() {
            CouponValidationResponse response = promotionService.validateCoupon("", 10000L);

            assertThat(response.isValid()).isFalse();
            assertThat(response.getMessage()).contains("vacío");
            verify(promotionRepository, never()).findValidByCode(any(), any());
        }

        @Test
        void codigoNulo_retornaInvalido() {
            CouponValidationResponse response = promotionService.validateCoupon(null, 10000L);

            assertThat(response.isValid()).isFalse();
        }

        @Test
        void codigoNoEncontrado_retornaInvalido() {
            when(promotionRepository.findValidByCode(eq("INVALIDO"), any(Instant.class)))
                    .thenReturn(Optional.empty());

            CouponValidationResponse response = promotionService.validateCoupon("INVALIDO", 10000L);

            assertThat(response.isValid()).isFalse();
            assertThat(response.getMessage()).contains("Cupón inválido");
        }

        @Test
        void subtotalBajoDelMinimo_retornaInvalido() {
            activePromo.setMinimumPurchaseAmount(20000L); // mínimo $200
            when(promotionRepository.findValidByCode(eq("VERANO20"), any(Instant.class)))
                    .thenReturn(Optional.of(activePromo));

            CouponValidationResponse response = promotionService.validateCoupon("VERANO20", 5000L);

            assertThat(response.isValid()).isFalse();
            assertThat(response.getMessage()).contains("200");
        }
    }

    // ── computeDiscount ───────────────────────────────────────────────────────

    @Nested
    class ComputeDiscount {

        @Test
        void tipoPercentage_calculaCorrectamente() {
            // 15.00% de $100 ARS = $15
            activePromo.setType(PromotionType.PERCENTAGE);
            activePromo.setValue(1500L); // 15.00%

            long discount = promotionService.computeDiscount(activePromo, 10000L);

            assertThat(discount).isEqualTo(1500L); // 15% de 10000 centavos
        }

        @Test
        void tipoFixedAmount_retornaElValorFijo() {
            activePromo.setType(PromotionType.FIXED_AMOUNT);
            activePromo.setValue(500L); // $5 fijos

            long discount = promotionService.computeDiscount(activePromo, 10000L);

            assertThat(discount).isEqualTo(500L);
        }

        @Test
        void tipoFixedAmount_capsEnElSubtotal() {
            activePromo.setType(PromotionType.FIXED_AMOUNT);
            activePromo.setValue(15000L); // $150 fijos, pero subtotal es $50

            long discount = promotionService.computeDiscount(activePromo, 5000L);

            assertThat(discount).isEqualTo(5000L); // no puede superar el subtotal
        }
    }
}
