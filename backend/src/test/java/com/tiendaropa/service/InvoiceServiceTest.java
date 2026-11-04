package com.tiendaropa.service;

import com.tiendaropa.entity.Address;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.OrderItem;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests para InvoiceService.
 * Verifica la generación de PDFs de comprobantes de compra.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InvoiceServiceTest {

    @Mock OrderRepository orderRepository;
    @InjectMocks InvoiceService invoiceService;

    private User user;
    private Address address;
    private Order order;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("juan@example.com")
                .firstName("Juan")
                .lastName("Pérez")
                .build();

        address = Address.builder()
                .id(1L)
                .street("Av. Corrientes")
                .apartment("3B")
                .city("Buenos Aires")
                .province("CABA")
                .postalCode("C1043AAQ")
                .build();

        order = Order.builder()
                .id(100L)
                .user(user)
                .status(OrderStatus.PAID)
                .shippingAddress(address)
                .subtotalAmount(1500000L) // $15,000.00
                .discountAmount(150000L)   // $1,500.00
                .taxAmount(315000L)       // $3,150.00 (21% IVA)
                .shippingAmount(250000L)  // $2,500.00
                .totalAmount(1915000L)    // $19,150.00
                .currencyCode("ARS")
                .paymentMethod("MERCADOPAGO")
                .installments(3)
                .createdAt(Instant.parse("2026-03-15T14:30:00Z"))
                .build();
    }

    private OrderItem createItem(Long id, String name, String color, String size, int qty, long price) {
        return OrderItem.builder()
                .id(id)
                .order(order)
                .productVariant(null) // not needed for invoice
                .productName(name)
                .variantColor(color)
                .variantSize(size)
                .quantity(qty)
                .unitPriceAmount(price)
                .currencyCode("ARS")
                .build();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-001: Happy path - PDF generation
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("INV-001: Generación exitosa de PDF")
    class GeneracionExitosa {

        @Test
        @DisplayName("INV-001-001: Generate returns non-null byte array")
        void generate_retornaBytesNoNulos() {
            // Given
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 2, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then
            assertThat(pdf).isNotNull();
            assertThat(pdf.length).isGreaterThan(0);
        }

        @Test
        @DisplayName("INV-001-002: Generate returns valid PDF magic bytes")
        void generate_retornaPDFValido() {
            // Given
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 2, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then - PDF files start with "%PDF" and contain %%EOF marker
            String header = new String(pdf, 0, 4);
            assertThat(header).isEqualTo("%PDF");
            
            // PDF footer marker appears somewhere near the end (may have padding)
            String pdfText = new String(pdf);
            assertThat(pdfText).contains("%%EOF");
        }

        @Test
        @DisplayName("INV-001-003: PDF contains PDF version marker")
        void generate_pdfContieneVersion() {
            // Given
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);
            String pdfText = new String(pdf);

            // Then - PDF contains version and catalog info
            assertThat(pdfText).contains("PDF-");
            assertThat(pdfText).contains("/Type/Catalog");
        }

        @Test
        @DisplayName("INV-001-004: PDF contains LiberationSans font (Latin characters)")
        void generate_pdfContieneFuenteLatin() {
            // Given
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);
            String pdfText = new String(pdf);

            // Then - PDF uses LiberationSans for Latin characters
            assertThat(pdfText).contains("LiberationSans");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-002: Edge cases
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("INV-002: Casos edge")
    class CasosEdge {

        @Test
        @DisplayName("INV-002-001: Order without shipping address generates valid PDF")
        void generate_sinDireccionEnvio() {
            // Given
            order.setShippingAddress(null);
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then - should not throw, should generate valid PDF
            assertThat(pdf).isNotNull();
            assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
        }

        @Test
        @DisplayName("INV-002-002: Order without discount generates valid PDF")
        void generate_sinDescuento() {
            // Given
            order.setDiscountAmount(0L);
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then
            assertThat(pdf).isNotNull();
            assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
        }

        @Test
        @DisplayName("INV-002-003: Order with different payment method generates valid PDF")
        void generate_transferenciaBancaria() {
            // Given
            order.setPaymentMethod("TRANSFER");
            order.setInstallments(1);
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then
            assertThat(pdf).isNotNull();
            assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
        }

        @Test
        @DisplayName("INV-002-004: Cancelled order generates valid PDF")
        void generate_pedidoCancelado() {
            // Given
            order.setStatus(OrderStatus.CANCELLED);
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdf = invoiceService.generate(1L, 100L);

            // Then
            assertThat(pdf).isNotNull();
            assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
        }

        @Test
        @DisplayName("INV-002-005: Multiple items generate larger PDF")
        void generate_multiplesItems() {
            // Given
            order.setItems(List.of(
                    createItem(1L, "Oversize Tee", "White", "L", 3, 450000L),
                    createItem(2L, "Cargo Pants", "Green", "38", 2, 650000L),
                    createItem(3L, "Hoodie", "Gray", "M", 1, 800000L)
            ));
            when(orderRepository.findByIdAndUserId(100L, 1L))
                    .thenReturn(Optional.of(order));

            // When
            byte[] pdfMulti = invoiceService.generate(1L, 100L);
            
            // Reset items to single item
            order.setItems(List.of(
                    createItem(1L, "Basic Tee", "Black", "M", 1, 500000L)
            ));
            byte[] pdfSingle = invoiceService.generate(1L, 100L);

            // Then - more items = larger PDF
            assertThat(pdfMulti.length).isGreaterThan(pdfSingle.length);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-003: Error handling
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("INV-003: Manejo de errores")
    class ManejoErrores {

        @Test
        @DisplayName("INV-003-001: Order not found throws ResourceNotFoundException")
        void generate_ordenNoEncontrada() {
            // Given
            when(orderRepository.findByIdAndUserId(999L, 1L))
                    .thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> invoiceService.generate(1L, 999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order not found");
        }

        @Test
        @DisplayName("INV-003-002: Order belongs to different user")
        void generate_ordenDeOtroUsuario() {
            // Given - findByIdAndUserId returns empty if order doesn't belong to user
            when(orderRepository.findByIdAndUserId(100L, 999L))
                    .thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> invoiceService.generate(999L, 100L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order not found");
        }
    }
}
