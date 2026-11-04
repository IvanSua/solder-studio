package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreateReturnRequest;
import com.tiendaropa.dto.response.ReturnRequestResponse;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.ReturnRequest;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.ReturnStatus;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ReturnRequestRepository;
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

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests para ReturnService — enfocados en email transactional integration.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReturnServiceTest {

    @Mock ReturnRequestRepository returnRepo;
    @Mock OrderRepository orderRepo;
    @Mock UserRepository userRepo;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;
    @InjectMocks ReturnService returnService;

    private User user;
    private Order order;
    private ReturnRequest returnRequest;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("juan@example.com")
                .firstName("Juan")
                .lastName("Pérez")
                .build();

        order = Order.builder()
                .id(100L)
                .user(user)
                .status(OrderStatus.DELIVERED)
                .totalAmount(15000L)
                .build();

        returnRequest = ReturnRequest.builder()
                .id(1L)
                .user(user)
                .order(order)
                .reason("WRONG_SIZE")
                .description("El talle no me queda")
                .resolution("REFUND")
                .status(ReturnStatus.PENDING)
                .build();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RET-001: Create return request
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("RET-001: Crear solicitud de devolución")
    class CrearSolicitud {

        @Test
        @DisplayName("RET-001-001: Creación exitosa envía email de confirmación")
        void crear_exitoso_enviaEmail() {
            // Given
            CreateReturnRequest req = new CreateReturnRequest();
            req.setOrderId(100L);
            req.setReason("WRONG_SIZE");
            req.setDescription("Talle equivocado");
            req.setResolution("REFUND");

            when(userRepo.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepo.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));
            when(returnRepo.existsByOrderIdAndStatusNotIn(eq(100L), anyList())).thenReturn(false);
            when(returnRepo.save(any(ReturnRequest.class))).thenAnswer(i -> {
                ReturnRequest r = i.getArgument(0);
                r.setId(1L);
                return r;
            });

            // When
            ReturnRequestResponse response = returnService.create(1L, req);

            // Then
            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getStatus()).isEqualTo("PENDING");

            // Verify in-app notification
            verify(notificationService).createAsync(
                    eq(1L),
                    eq(NotificationType.ORDER_STATUS_CHANGE),
                    anyString(),
                    anyString(),
                    anyString()
            );

            // Verify email sent
            verify(emailService).sendReturnStatusUpdate(
                    eq(1L),
                    eq(100L),
                    eq("PENDING"),
                    anyString(),
                    eq("REFUND"),
                    eq("juan@example.com"),
                    eq("Juan")
            );
        }

        @Test
        @DisplayName("RET-001-002: Creación en orden no entregado lanza excepción")
        void crear_ordenNoEntregado_lanzaExcepcion() {
            // Given
            order.setStatus(OrderStatus.PREPARING);
            CreateReturnRequest req = new CreateReturnRequest();
            req.setOrderId(100L);
            req.setReason("WRONG_SIZE");

            when(userRepo.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepo.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));

            // When/Then
            assertThatThrownBy(() -> returnService.create(1L, req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not eligible");

            verify(returnRepo, never()).save(any());
            verify(emailService, never()).sendReturnStatusUpdate(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("RET-001-003: Solicitud duplicada es rechazada")
        void crear_solicitudDuplicada_rechazada() {
            // Given
            CreateReturnRequest req = new CreateReturnRequest();
            req.setOrderId(100L);
            req.setReason("WRONG_SIZE");

            when(userRepo.findById(1L)).thenReturn(Optional.of(user));
            when(orderRepo.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(order));
            when(returnRepo.existsByOrderIdAndStatusNotIn(eq(100L), anyList())).thenReturn(true);

            // When/Then
            assertThatThrownBy(() -> returnService.create(1L, req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already exists");

            verify(returnRepo, never()).save(any());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RET-002: Admin update status
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("RET-002: Admin actualiza estado")
    class AdminActualizaEstado {

        @Test
        @DisplayName("RET-002-001: Admin aprueba y envía email")
        void adminAprueba_enviaEmail() {
            // Given
            returnRequest.setStatus(ReturnStatus.PENDING);
            when(returnRepo.findById(1L)).thenReturn(Optional.of(returnRequest));
            when(returnRepo.save(any(ReturnRequest.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, String> patch = Map.of("status", "APPROVED");

            // When
            ReturnRequestResponse response = returnService.adminUpdate(1L, patch);

            // Then
            assertThat(response.getStatus()).isEqualTo("APPROVED");

            // Verify in-app notification
            verify(notificationService).createAsync(
                    eq(1L),
                    eq(NotificationType.ORDER_STATUS_CHANGE),
                    anyString(),
                    anyString(),
                    eq("/orders")
            );

            // Verify email sent with APPROVED status
            verify(emailService).sendReturnStatusUpdate(
                    eq(1L),
                    eq(100L),
                    eq("APPROVED"),
                    anyString(),
                    eq("REFUND"),
                    eq("juan@example.com"),
                    eq("Juan")
            );
        }

        @Test
        @DisplayName("RET-002-002: Admin rechaza y envía email")
        void adminRechaza_enviaEmail() {
            // Given
            returnRequest.setStatus(ReturnStatus.PENDING);
            when(returnRepo.findById(1L)).thenReturn(Optional.of(returnRequest));
            when(returnRepo.save(any(ReturnRequest.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, String> patch = Map.of("status", "REJECTED");

            // When
            ReturnRequestResponse response = returnService.adminUpdate(1L, patch);

            // Then
            assertThat(response.getStatus()).isEqualTo("REJECTED");

            verify(emailService).sendReturnStatusUpdate(
                    eq(1L),
                    eq(100L),
                    eq("REJECTED"),
                    anyString(),
                    eq("REFUND"),
                    eq("juan@example.com"),
                    eq("Juan")
            );
        }

        @Test
        @DisplayName("RET-002-003: Admin marca completado y envía email")
        void adminCompleta_enviaEmail() {
            // Given
            returnRequest.setStatus(ReturnStatus.IN_PROGRESS);
            returnRequest.setResolution("EXCHANGE");
            when(returnRepo.findById(1L)).thenReturn(Optional.of(returnRequest));
            when(returnRepo.save(any(ReturnRequest.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, String> patch = Map.of("status", "COMPLETED");

            // When
            ReturnRequestResponse response = returnService.adminUpdate(1L, patch);

            // Then
            assertThat(response.getStatus()).isEqualTo("COMPLETED");

            verify(emailService).sendReturnStatusUpdate(
                    eq(1L),
                    eq(100L),
                    eq("COMPLETED"),
                    anyString(),
                    eq("EXCHANGE"),
                    eq("juan@example.com"),
                    eq("Juan")
            );
        }

        @Test
        @DisplayName("RET-002-004: Cambio al mismo estado no envía notificación")
        void adminMismoEstado_noEnviaNotificacion() {
            // Given
            returnRequest.setStatus(ReturnStatus.PENDING);
            when(returnRepo.findById(1L)).thenReturn(Optional.of(returnRequest));
            when(returnRepo.save(any(ReturnRequest.class))).thenAnswer(i -> i.getArgument(0));

            Map<String, String> patch = Map.of("adminNotes", "Nota interna");

            // When
            ReturnRequestResponse response = returnService.adminUpdate(1L, patch);

            // Then
            assertThat(response.getAdminNotes()).isEqualTo("Nota interna");

            // No email since status didn't change
            verify(emailService, never()).sendReturnStatusUpdate(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("RET-002-005: Return no encontrado lanza ResourceNotFoundException")
        void adminUpdate_returnNoEncontrado_lanzaExcepcion() {
            // Given
            when(returnRepo.findById(999L)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> returnService.adminUpdate(999L, Map.of("status", "APPROVED")))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Return request not found");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RET-003: Customer queries
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("RET-003: Consultas de cliente")
    class ConsultasCliente {

        @Test
        @DisplayName("RET-003-001: Cliente puede ver sus devoluciones")
        void getMyReturns_devuelveLista() {
            // Given
            when(returnRepo.findByUserIdOrderByCreatedAtDesc(1L))
                    .thenReturn(List.of(returnRequest));

            // When
            List<ReturnRequestResponse> results = returnService.getMyReturns(1L);

            // Then
            assertThat(results).hasSize(1);
            assertThat(results.get(0).getId()).isEqualTo(1L);
        }

        @Test
        @DisplayName("RET-003-002: Cliente puede ver detalle de devolución")
        void getMyReturn_devuelveDetalle() {
            // Given
            when(returnRepo.findByIdAndUserId(1L, 1L))
                    .thenReturn(Optional.of(returnRequest));

            // When
            ReturnRequestResponse result = returnService.getMyReturn(1L, 1L);

            // Then
            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(1L);
        }

        @Test
        @DisplayName("RET-003-003: Return de otro usuario lanza excepción")
        void getMyReturn_otroUsuario_lanzaExcepcion() {
            // Given
            when(returnRepo.findByIdAndUserId(1L, 999L))
                    .thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> returnService.getMyReturn(999L, 1L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
