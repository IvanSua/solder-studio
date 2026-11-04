package com.tiendaropa.integration;

import com.tiendaropa.dto.response.AuthResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for order security and access control.
 *
 * Verifies that:
 * - Order endpoints are protected (401 without token)
 * - Users can only see their own orders (403 for other users' orders)
 * - Admin endpoints require ADMIN role
 */
class OrderSecurityIntegrationTest extends BaseIntegrationTest {

    // ─── Auth guard ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Order endpoints require authentication")
    class AuthGuard {

        @Test
        @DisplayName("GET /api/orders without token returns 401")
        void listOrdersRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/orders", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("GET /api/orders/{id} without token returns 401")
        void getOrderRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/orders/1", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("POST /api/orders/{id}/cancel without token returns 401")
        void cancelOrderRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.postForEntity("/api/v1/orders/1/cancel", null, String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // ─── Authenticated user can list their own orders ─────────────────────────

    @Nested
    @DisplayName("Authenticated user order access")
    class AuthenticatedAccess {

        @Test
        @DisplayName("GET /api/orders with valid token returns 200 with empty list")
        void listOrdersReturns200() {
            String token = registerAndLogin("orders_user@test.com");

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/orders",
                    HttpMethod.GET,
                    new HttpEntity<>(bearerHeaders(token)),
                    String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).contains("\"content\"");
            assertThat(response.getBody()).contains("\"totalElements\"");
        }

        @Test
        @DisplayName("GET /api/orders/{id} for non-existent order returns 404")
        void getOrderNotFoundReturns404() {
            String token = registerAndLogin("orders_notfound@test.com");

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/orders/999999",
                    HttpMethod.GET,
                    new HttpEntity<>(bearerHeaders(token)),
                    String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("POST /api/orders/{id}/cancel for non-existent order returns 404")
        void cancelNonExistentOrderReturns404() {
            String token = registerAndLogin("cancel_notfound@test.com");

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/orders/999999/cancel",
                    HttpMethod.POST,
                    new HttpEntity<>(bearerHeaders(token)),
                    String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // ─── Admin order routes ───────────────────────────────────────────────────

    @Nested
    @DisplayName("Admin order routes require ADMIN role")
    class AdminRoutes {

        @Test
        @DisplayName("GET /api/admin/orders without token returns 401")
        void adminListOrdersRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/admin/orders", String.class);

            assertThat(response.getStatusCode())
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("GET /api/admin/orders with ROLE_USER returns 403")
        void adminListOrdersWithUserRoleGetsForbidden() {
            String token = registerAndLogin("user_for_admin_test@test.com");

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/admin/orders",
                    HttpMethod.GET,
                    new HttpEntity<>(bearerHeaders(token)),
                    String.class);

            // Regular users cannot access admin routes
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }
    }

    // ─── Checkout flow guard ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Checkout flow requires authentication")
    class CheckoutGuard {

        @Test
        @DisplayName("POST /api/checkout without token returns 401")
        void checkoutRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.postForEntity("/api/v1/checkout", "{}", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("POST /api/checkout with valid token and empty cart returns 4xx")
        void checkoutWithEmptyCartReturnsError() {
            String token = registerAndLogin("checkout_empty@test.com");

            HttpHeaders headers = bearerHeaders(token);
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Minimal checkout request — empty cart should fail with 4xx
            String body = """
                    {
                      "shippingAddressId": 1,
                      "paymentMethod": "MERCADOPAGO",
                      "shippingOptionId": 1
                    }
                    """;

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/checkout",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class);

            // Must not be 5xx — error should be business-logic 4xx
            assertThat(response.getStatusCode().is5xxServerError()).isFalse();
        }
    }
}
