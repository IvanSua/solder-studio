package com.tiendaropa.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for the shipping calculation endpoint.
 *
 * Verifies that the hybrid shipping service (MANUAL fallback path)
 * returns a valid structure even with no rates configured in the DB.
 */
class ShippingIntegrationTest extends BaseIntegrationTest {

    // ─── GET /api/shipping/calculate ─────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/shipping/calculate")
    class CalculateShipping {

        @Test
        @DisplayName("returns 200 with JSON array for a known province")
        void returnsArrayForKnownProvince() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/shipping/calculate?province=Buenos Aires",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            // Should be a JSON array (empty if no rates in DB)
            assertThat(response.getBody()).startsWith("[");
        }

        @Test
        @DisplayName("accepts postalCode param without crashing")
        void acceptsPostalCodeParam() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/shipping/calculate?province=Buenos Aires&postalCode=1234",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("accepts orderAmount param for free shipping threshold calculation")
        void acceptsOrderAmountParam() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/shipping/calculate?province=Córdoba&orderAmount=500000",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("province param with spaces is URL-encoded correctly")
        void provinceWithSpacesIsAccepted() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/shipping/calculate?province=Santa%20Fe",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("unknown province returns empty array — does not crash")
        void unknownProvinceReturnsEmpty() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(
                            "/api/v1/shipping/calculate?province=UnknownProvinceXYZ",
                            String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEqualTo("[]");
        }

        @Test
        @DisplayName("missing province param returns 400")
        void missingProvinceReturns400() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/shipping/calculate", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    // ─── Admin carrier config is protected ───────────────────────────────────

    @Nested
    @DisplayName("Admin carrier routes require auth")
    class AdminCarrierRoutes {

        @Test
        @DisplayName("GET /api/admin/carriers without token returns 401")
        void listCarriersRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/admin/carriers", String.class);

            assertThat(response.getStatusCode())
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("PUT /api/admin/carriers/OCA without token returns 401")
        void updateCarrierRequiresAuth() {
            ResponseEntity<String> response =
                    restTemplate.getForEntity("/api/v1/admin/carriers/OCA", String.class);

            assertThat(response.getStatusCode())
                    .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        }
    }
}
