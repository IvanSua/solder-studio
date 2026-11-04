package com.tiendaropa.service;

import com.tiendaropa.dto.response.LoyaltyProfileResponse;
import com.tiendaropa.dto.response.PointTransactionResponse;
import com.tiendaropa.dto.response.SavedSizeResponse;
import com.tiendaropa.entity.PointTransaction;
import com.tiendaropa.entity.SavedSize;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserLevel;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.PointTransactionRepository;
import com.tiendaropa.repository.SavedSizeRepository;
import com.tiendaropa.repository.UserRepository;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests para PointsService — enfocados en email transactional integration.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PointsServiceTest {

    @Mock UserRepository userRepository;
    @Mock PointTransactionRepository txRepository;
    @Mock SavedSizeRepository savedSizeRepository;
    @Mock EmailService emailService;
    @Mock BusinessMetricsService metrics;
    @InjectMocks PointsService pointsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("juan@example.com")
                .firstName("Juan")
                .lastName("Pérez")
                .points(500)
                .level(UserLevel.SILVER)
                .referralCode("JUAN2024")
                .build();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-001: Award points
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-001: Otorgar puntos")
    class OtorgarPuntos {

        @Test
        @DisplayName("PTS-001-001: awardPoints envía email al usuario")
        void awardPoints_enviaEmail() {
            // Given
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
            when(txRepository.save(any(PointTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // When
            pointsService.awardPoints(1L, 150, "ORDER_DELIVERED", 100L);

            // Then
            // Verify email sent
            verify(emailService).sendPointsAwarded(
                    eq(150),
                    eq(650), // 500 + 150
                    eq("ORDER_DELIVERED"),
                    eq("juan@example.com"),
                    eq("Juan")
            );

            // Verify user points updated
            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getPoints()).isEqualTo(650);
        }

        @Test
        @DisplayName("PTS-001-002: awardPoints registra transacción")
        void awardPoints_registraTransaccion() {
            // Given
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
            when(txRepository.save(any(PointTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // When
            pointsService.awardPoints(1L, 200, "REFERRAL", 50L);

            // Then
            ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
            verify(txRepository).save(txCaptor.capture());

            PointTransaction tx = txCaptor.getValue();
            assertThat(tx.getUser()).isEqualTo(user);
            assertThat(tx.getAmount()).isEqualTo(200);
            assertThat(tx.getReason()).isEqualTo("REFERRAL");
            assertThat(tx.getReferenceId()).isEqualTo(50L);
        }

        @Test
        @DisplayName("PTS-001-003: Usuario no encontrado lanza ResourceNotFoundException")
        void awardPoints_usuarioNoEncontrado_lanzaExcepcion() {
            // Given
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> pointsService.awardPoints(999L, 100, "ORDER_DELIVERED", null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User not found");

            verify(emailService, never()).sendPointsAwarded(anyInt(), anyInt(), any(), any(), any());
        }

        @Test
        @DisplayName("PTS-001-004: Puntos actualizan nivel del usuario")
        void awardPoints_actualizaNivel() {
            // Given
            user.setPoints(900);
            user.setLevel(UserLevel.SILVER);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
            when(txRepository.save(any(PointTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // When
            pointsService.awardPoints(1L, 2000, "ORDER_DELIVERED", 100L);

            // Then
            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getPoints()).isEqualTo(2900);
            assertThat(userCaptor.getValue().getLevel()).isEqualTo(UserLevel.GOLD);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-002: Award order points
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-002: Puntos por pedido")
    class PuntosPorPedido {

        @Test
        @DisplayName("PTS-002-001: awardOrderPoints calcula 1 punto por $100 ARS")
        void awardOrderPoints_calculoCorrecto() {
            // Given
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
            when(txRepository.save(any(PointTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // When (50000 cents = $500 ARS = 5 puntos)
            pointsService.awardOrderPoints(1L, 100L, 50000L);

            // Then
            ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
            verify(txRepository).save(txCaptor.capture());
            assertThat(txCaptor.getValue().getAmount()).isEqualTo(5);
        }

        @Test
        @DisplayName("PTS-002-002: Cantidad menor a $100 ARS no otorga puntos")
        void awardOrderPoints_montoMuyBajo_noOtorgaPuntos() {
            // When (9999 cents = $99.99 ARS < $100)
            pointsService.awardOrderPoints(1L, 100L, 9999L);

            // Then
            verify(userRepository, never()).save(any());
            verify(txRepository, never()).save(any());
            verify(emailService, never()).sendPointsAwarded(anyInt(), anyInt(), any(), any(), any());
        }

        @Test
        @DisplayName("PTS-002-003: Monto null no otorga puntos")
        void awardOrderPoints_montoNull_noOtorgaPuntos() {
            // When
            pointsService.awardOrderPoints(1L, 100L, null);

            // Then
            verify(userRepository, never()).save(any());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-003: Loyalty profile
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-003: Perfil de lealtad")
    class PerfilLealtad {

        @Test
        @DisplayName("PTS-003-001: getLoyalty devuelve perfil completo")
        void getLoyalty_devuelvePerfilCompleto() {
            // Given
            user.setPoints(750);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.countByReferredById(1L)).thenReturn(3L);
            when(savedSizeRepository.findByUserIdOrderByCategoryName(1L)).thenReturn(List.of());

            // When
            LoyaltyProfileResponse profile = pointsService.getLoyalty(1L);

            // Then
            assertThat(profile.getPoints()).isEqualTo(750);
            assertThat(profile.getLevel()).isEqualTo("SILVER");
            assertThat(profile.getReferralCode()).isEqualTo("JUAN2024");
            assertThat(profile.getReferralCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("PTS-003-002: getLoyalty para PLATINUM sin siguiente nivel")
        void getLoyalty_platinum_sinSiguienteNivel() {
            // Given - PLATINUM starts at 5000 points
            user.setPoints(5000);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.countByReferredById(1L)).thenReturn(0L);
            when(savedSizeRepository.findByUserIdOrderByCategoryName(1L)).thenReturn(List.of());

            // When
            LoyaltyProfileResponse profile = pointsService.getLoyalty(1L);

            // Then
            assertThat(profile.getLevel()).isEqualTo("PLATINUM");
            assertThat(profile.getNextLevelPoints()).isEqualTo(0);
            assertThat(profile.getPointsToNextLevel()).isEqualTo(0);
            assertThat(profile.getLevelProgress()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("PTS-003-003: getLoyalty calcula progreso al siguiente nivel")
        void getLoyalty_calculaProgreso() {
            // Given - 300 points is BRONZE (0-499), next level is SILVER (500+)
            user.setPoints(300);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.countByReferredById(1L)).thenReturn(0L);
            when(savedSizeRepository.findByUserIdOrderByCategoryName(1L)).thenReturn(List.of());

            // When
            LoyaltyProfileResponse profile = pointsService.getLoyalty(1L);

            // Then
            assertThat(profile.getNextLevelPoints()).isEqualTo(500); // SILVER min
            assertThat(profile.getPointsToNextLevel()).isEqualTo(200); // 500 - 300
            // (300 - 0) / (500 - 0) = 300/500 = 0.6
            assertThat(profile.getLevelProgress()).isCloseTo(0.6, within(0.01));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-004: Points history
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-004: Historial de puntos")
    class HistorialPuntos {

        @Test
        @DisplayName("PTS-004-001: getHistory devuelve página de transacciones")
        void getHistory_devuelvePagina() {
            // Given
            PointTransaction tx = PointTransaction.builder()
                    .id(1L)
                    .user(user)
                    .amount(100)
                    .reason("ORDER_DELIVERED")
                    .referenceId(50L)
                    .createdAt(Instant.now())
                    .build();

            Page<PointTransaction> page = new PageImpl<>(List.of(tx));
            Pageable pageable = PageRequest.of(0, 10);
            when(txRepository.findByUserIdOrderByCreatedAtDesc(1L, pageable)).thenReturn(page);

            // When
            Page<PointTransactionResponse> result = pointsService.getHistory(1L, pageable);

            // Then
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getAmount()).isEqualTo(100);
            assertThat(result.getContent().get(0).getReason()).isEqualTo("ORDER_DELIVERED");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-005: Saved sizes
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-005: Talles guardados")
    class TallesGuardados {

        @Test
        @DisplayName("PTS-005-001: saveSizes guarda talles nuevos")
        void saveSizes_guardaTallesNuevos() {
            // Given
            var remeraEntry = new com.tiendaropa.dto.request.SavedSizesRequest.SizeEntry();
            remeraEntry.setCategoryName("Remeras");
            remeraEntry.setSize("M");

            var pantsEntry = new com.tiendaropa.dto.request.SavedSizesRequest.SizeEntry();
            pantsEntry.setCategoryName("Pantalones");
            pantsEntry.setSize("42");

            var entries = List.of(remeraEntry, pantsEntry);

            SavedSize remeraSize = SavedSize.builder()
                    .id(1L)
                    .user(user)
                    .categoryName("Remeras")
                    .size("M")
                    .build();

            SavedSize pantsSize = SavedSize.builder()
                    .id(2L)
                    .user(user)
                    .categoryName("Pantalones")
                    .size("42")
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(savedSizeRepository.findByUserIdAndCategoryName(eq(1L), anyString()))
                    .thenReturn(Optional.empty());
            when(savedSizeRepository.save(any(SavedSize.class))).thenAnswer(i -> {
                SavedSize s = i.getArgument(0);
                s.setId(System.nanoTime());
                return s;
            });
            when(savedSizeRepository.findByUserIdOrderByCategoryName(1L))
                    .thenReturn(List.of(remeraSize, pantsSize));

            // When
            List<SavedSizeResponse> result = pointsService.saveSizes(1L, entries);

            // Then
            assertThat(result).hasSize(2);
            verify(savedSizeRepository, times(2)).save(any(SavedSize.class));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PTS-006: Level calculation
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PTS-006: Cálculo de nivel")
    class CalculoNivel {

        @Test
        @DisplayName("PTS-006-001: calculateLevel retorna BRONZE bajo 500")
        void calculateLevel_bronce() {
            assertThat(pointsService.calculateLevel(0)).isEqualTo(UserLevel.BRONZE);
            assertThat(pointsService.calculateLevel(499)).isEqualTo(UserLevel.BRONZE);
        }

        @Test
        @DisplayName("PTS-006-002: calculateLevel retorna SILVER entre 500-1999")
        void calculateLevel_silver() {
            assertThat(pointsService.calculateLevel(500)).isEqualTo(UserLevel.SILVER);
            assertThat(pointsService.calculateLevel(1999)).isEqualTo(UserLevel.SILVER);
        }

        @Test
        @DisplayName("PTS-006-003: calculateLevel retorna GOLD entre 2000-4999")
        void calculateLevel_gold() {
            assertThat(pointsService.calculateLevel(2000)).isEqualTo(UserLevel.GOLD);
            assertThat(pointsService.calculateLevel(4999)).isEqualTo(UserLevel.GOLD);
        }

        @Test
        @DisplayName("PTS-006-004: calculateLevel retorna PLATINUM 5000+")
        void calculateLevel_platinum() {
            assertThat(pointsService.calculateLevel(5000)).isEqualTo(UserLevel.PLATINUM);
            assertThat(pointsService.calculateLevel(10000)).isEqualTo(UserLevel.PLATINUM);
        }
    }
}
