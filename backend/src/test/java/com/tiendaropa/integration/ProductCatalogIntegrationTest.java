package com.tiendaropa.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the public product catalog endpoints.
 *
 * Tests cover: listing, search, pagination, and category filters.
 * No auth required — these are public routes.
 */
class ProductCatalogIntegrationTest extends BaseIntegrationTest {

    // ─── GET /api/products ────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/products")
    class ListProducts {

        @Test
        @DisplayName("returns 200 with paginated response structure")
        void returnsPaginatedStructure() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/products", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).contains("\"content\"");
            assertThat(response.getBody()).contains("\"totalElements\"");
            assertThat(response.getBody()).contains("\"totalPages\"");
        }

        @Test
        @DisplayName("accepts page and size query params without crashing")
        void acceptsPaginationParams() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/products?page=0&size=10", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("search param does not crash the app")
        void searchParamDoesNotCrash() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/products?search=remera", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).contains("\"content\"");
        }

        @Test
        @DisplayName("price range filter does not crash the app")
        void priceRangeFilterDoesNotCrash() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/products?minPrice=1000&maxPrice=50000", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("combined filters do not crash the app")
        void combinedFiltersDoNotCrash() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/products?search=remera&minPrice=1000&page=0&size=5&sort=price,asc",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    // ─── GET /api/products/{slug} ─────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/products/{slug}")
    class ProductDetail {

        @Test
        @DisplayName("unknown slug returns 404")
        void unknownSlugReturns404() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/products/non-existent-slug-xyz", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // ─── GET /api/categories ──────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/categories")
    class Categories {

        @Test
        @DisplayName("returns 200 with array structure")
        void returnsCategories() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/categories", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            // Should be a JSON array (even if empty)
            assertThat(response.getBody()).startsWith("[");
        }
    }

    // ─── Security: admin routes are protected ─────────────────────────────────

    @Nested
    @DisplayName("Admin product routes require auth")
    class AdminRoutes {

        @Test
        @DisplayName("POST /api/admin/products without token returns 401")
        void adminCreateProductRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.postForEntity("/api/v1/admin/products", "{}", String.class);

            assertThat(response.getStatusCode())
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("GET /api/admin/products without token returns 401")
        void adminListProductsRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/admin/products", String.class);

            assertThat(response.getStatusCode())
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }
    }
}
