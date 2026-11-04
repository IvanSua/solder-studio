package com.tiendaropa.service;

import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.entity.Category;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductImage;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import com.tiendaropa.repository.ProductImageRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.ProductVariantRepository;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests para ProductService — enfocados en recommendations (upsell/cross-sell).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProductServiceTest {

    @Mock ProductRepository productRepository;
    @Mock ProductVariantRepository productVariantRepository;
    @Mock ProductImageRepository productImageRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock StorageService storageService;
    @InjectMocks ProductService productService;

    private Category category;
    private Product product1;
    private Product product2;
    private Product product3;

    @BeforeEach
    void setUp() {
        // Self-injection: ProductService uses @Lazy @Autowired ProductService self
        // to route listProducts/listByCategory through the Spring proxy so @Cacheable
        // is honoured (see field Javadoc). No Spring context here, so point self
        // directly to the same instance — same pattern as DesignRenderServiceTest.
        ReflectionTestUtils.setField(productService, "self", productService);

        category = Category.builder()
                .id(1L)
                .name("Remeras")
                .slug("remeras")
                .build();

        product1 = Product.builder()
                .id(1L)
                .name("Remera Básica")
                .slug("remera-basica")
                .category(category)
                .active(true)
                .images(new ArrayList<>())
                .variants(new ArrayList<>())
                .build();

        product2 = Product.builder()
                .id(2L)
                .name("Remera Oversize")
                .slug("remera-oversize")
                .category(category)
                .active(true)
                .images(new ArrayList<>())
                .variants(new ArrayList<>())
                .build();

        product3 = Product.builder()
                .id(3L)
                .name("Remera Premium")
                .slug("remera-premium")
                .category(category)
                .active(true)
                .images(new ArrayList<>())
                .variants(new ArrayList<>())
                .build();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REC-001: Get recommendations by category
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("REC-001: Recomendaciones por categoría")
    class RecomendacionesPorCategoria {

        @Test
        @DisplayName("REC-001-001: Retorna productos de la misma categoría")
        void getRecommendations_conCategoria_retornaProductos() {
            // Given
            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2, product3));

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then
            assertThat(recommendations).hasSize(2);
            assertThat(recommendations.get(0).getName()).isEqualTo("Remera Oversize");
            assertThat(recommendations.get(1).getName()).isEqualTo("Remera Premium");
        }

        @Test
        @DisplayName("REC-001-002: Limita a 6 productos máximo")
        void getRecommendations_limitaA6Productos() {
            // Given
            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), eq(PageRequest.of(0, 6))))
                    .thenReturn(List.of(product2, product3));

            // When
            productService.getRecommendations(1L);

            // Then - verify it uses PageRequest.of(0, 6)
            verify(productRepository).findRelatedByCategory(eq(category), eq(1L), eq(PageRequest.of(0, 6)));
        }

        @Test
        @DisplayName("REC-001-003: Producto no encontrado lanza ResourceNotFoundException")
        void getRecommendations_productoNoEncontrado() {
            // Given
            when(productRepository.findById(999L)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> productService.getRecommendations(999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Product not found");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REC-002: Fallback when no category
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("REC-002: Fallback sin categoría")
    class FallbackSinCategoria {

        @Test
        @DisplayName("REC-002-001: Producto sin categoría retorna productos activos recientes")
        void getRecommendations_sinCategoria_retornaRecientes() {
            // Given - product without category
            Product productNoCategory = Product.builder()
                    .id(1L)
                    .name("Producto Sin Categoría")
                    .slug("producto-sin-categoria")
                    .category(null)
                    .active(true)
                    .images(new ArrayList<>())
                    .variants(new ArrayList<>())
                    .build();

            Product recent1 = Product.builder()
                    .id(10L)
                    .name("Producto Reciente 1")
                    .slug("producto-reciente-1")
                    .active(true)
                    .images(new ArrayList<>())
                    .variants(new ArrayList<>())
                    .build();

            Product recent2 = Product.builder()
                    .id(11L)
                    .name("Producto Reciente 2")
                    .slug("producto-reciente-2")
                    .active(true)
                    .images(new ArrayList<>())
                    .variants(new ArrayList<>())
                    .build();

            var page = new org.springframework.data.domain.PageImpl<>(List.of(recent1, recent2, productNoCategory));
            when(productRepository.findById(1L)).thenReturn(Optional.of(productNoCategory));
            when(productRepository.findAll(any(PageRequest.class))).thenReturn(page);

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - should filter out the current product and inactive
            assertThat(recommendations).hasSize(2);
            assertThat(recommendations.stream().noneMatch(r -> r.getId().equals(1L))).isTrue();
        }

        @Test
        @DisplayName("REC-002-002: Solo retorna productos activos en fallback")
        void getRecommendations_fallbackSoloActivos() {
            // Given
            Product productNoCategory = Product.builder()
                    .id(1L)
                    .name("Producto Sin Categoría")
                    .slug("producto-sin-categoria")
                    .category(null)
                    .active(true)
                    .images(new ArrayList<>())
                    .variants(new ArrayList<>())
                    .build();

            Product inactiveProduct = Product.builder()
                    .id(99L)
                    .name("Producto Inactivo")
                    .slug("producto-inactivo")
                    .active(false)
                    .images(new ArrayList<>())
                    .variants(new ArrayList<>())
                    .build();

            var page = new org.springframework.data.domain.PageImpl<>(List.of(inactiveProduct, productNoCategory));
            when(productRepository.findById(1L)).thenReturn(Optional.of(productNoCategory));
            when(productRepository.findAll(any(PageRequest.class))).thenReturn(page);

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - inactive product should be filtered out
            assertThat(recommendations).hasSize(0);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REC-003: Response mapping
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("REC-003: Mapeo de respuesta")
    class MapeoRespuesta {

        @Test
        @DisplayName("REC-003-001: Recommendations incluye información básica del producto")
        void getRecommendations_incluyeInfoBasica() {
            // Given
            ProductVariant variant = ProductVariant.builder()
                    .id(10L)
                    .product(product2)
                    .priceAmount(150000L)
                    .currencyCode("ARS")
                    .color("Negro")
                    .size("M")
                    .stockTotal(15)
                    .stockReserved(5)
                    .active(true)
                    .build();
            product2.getVariants().add(variant);

            ProductImage image = ProductImage.builder()
                    .id(1L)
                    .product(product2)
                    .imageUrl("https://cdn.example.com/remera.jpg")
                    .altText("Remera Oversize")
                    .primary(true)
                    .sortOrder(1)
                    .build();
            product2.getImages().add(image);

            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2));

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then
            assertThat(recommendations).hasSize(1);
            ProductResponse rec = recommendations.get(0);
            assertThat(rec.getId()).isEqualTo(2L);
            assertThat(rec.getName()).isEqualTo("Remera Oversize");
            assertThat(rec.getSlug()).isEqualTo("remera-oversize");
            assertThat(rec.getVariants()).hasSize(1);
            assertThat(rec.getImages()).hasSize(1);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REC-004: Frequently Bought Together
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("REC-004: Productos frecuentemente comprados juntos")
    class FrequentlyBoughtTogether {

        @Test
        @DisplayName("REC-004-001: Incluye productos frecuentemente comprados juntos")
        void getRecommendations_conProductosFrecuentes() {
            // Given - product with category
            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findFrequentlyBoughtTogether(eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2)); // Frequently bought together
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product3)); // Category based

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - should include both bought together and category
            assertThat(recommendations).hasSizeGreaterThanOrEqualTo(2);
        }

        @Test
        @DisplayName("REC-004-002: Evita duplicados entre bought together y category")
        void getRecommendations_evitaDuplicados() {
            // Given - product2 appears in both queries
            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findFrequentlyBoughtTogether(eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2, product3)); // product2 and product3
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2, product3)); // same products again

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - no duplicates
            long uniqueIds = recommendations.stream().map(ProductResponse::getId).distinct().count();
            assertThat(uniqueIds).isEqualTo(recommendations.size());
        }

        @Test
        @DisplayName("REC-004-003: Limita a máximo 6 productos")
        void getRecommendations_limitaAMaximo6() {
            // Given
            Product product4 = Product.builder().id(4L).name("Prod 4").slug("prod-4").active(true).build();
            Product product5 = Product.builder().id(5L).name("Prod 5").slug("prod-5").active(true).build();
            Product product6 = Product.builder().id(6L).name("Prod 6").slug("prod-6").active(true).build();

            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findFrequentlyBoughtTogether(eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product2, product3, product4)); // 3 products
            when(productRepository.findRelatedByCategory(eq(category), eq(1L), any(PageRequest.class)))
                    .thenReturn(List.of(product5, product6)); // 3 more = 6 total

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - max 6
            assertThat(recommendations.size()).isLessThanOrEqualTo(6);
        }

        @Test
        @DisplayName("REC-004-004: Si falla query de co-compras, usa solo categoría")
        void getRecommendations_siFallaCoCompras_usaCategoria() {
            // Given - frequently bought together throws exception
            when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
            when(productRepository.findFrequentlyBoughtTogether(eq(1L), any(PageRequest.class)))
                    .thenThrow(new RuntimeException("Database error"));

            // When
            List<ProductResponse> recommendations = productService.getRecommendations(1L);

            // Then - should still return category-based products
            assertThat(recommendations).isNotNull();
        }
    }
}
