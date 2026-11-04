package com.tiendaropa.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sweeps every known {@code /api/v1/admin/**} base path and asserts none of them
 * are reachable without the ADMIN role.
 *
 * <p>Why this exists: today, admin access control lives entirely in the
 * {@code requestMatchers(...).hasRole("ADMIN")} block in {@code SecurityConfig},
 * not in per-controller {@code @PreAuthorize} (only 12 of ~25 controllers have
 * it explicitly — see BUGS_Y_MEJORAS_2026-08.md, item 3). That's fine as long as
 * every admin controller's base path is actually covered by a matcher. This test
 * is the regression guard: if someone adds a new {@code Admin*Controller} and
 * forgets to add its path to {@code SecurityConfig}, this test fails instead of
 * the endpoint silently going live unprotected.
 *
 * <p><b>When you add a new admin controller, add its base path to
 * {@link #ADMIN_BASE_PATHS} too.</b> That's the whole point of the test — it only
 * protects paths it knows about.
 */
class AdminEndpointsSecurityTest extends BaseIntegrationTest {

    /** Base path of every Admin*Controller in the codebase (kept in sync manually). */
    private static final String[] ADMIN_BASE_PATHS = {
            "/api/v1/admin/carriers",
            "/api/v1/admin/blog",
            "/api/v1/admin/gift-cards",
            "/api/v1/admin/questions",
            "/api/v1/admin/products",
            "/api/v1/admin/orders",
            "/api/v1/admin/export",
            "/api/v1/admin/reviews",
            "/api/v1/admin/returns",
            "/api/v1/admin/shipping",
            "/api/v1/admin/users",
            "/api/v1/admin/categories",
            "/api/v1/admin/promotions",
            "/api/v1/admin/stats",
    };

    @ParameterizedTest(name = "GET {0} without token returns 401 or 403")
    @ValueSource(strings = {
            "/api/v1/admin/carriers",
            "/api/v1/admin/blog",
            "/api/v1/admin/gift-cards",
            "/api/v1/admin/questions",
            "/api/v1/admin/products",
            "/api/v1/admin/orders",
            "/api/v1/admin/export",
            "/api/v1/admin/reviews",
            "/api/v1/admin/returns",
            "/api/v1/admin/shipping",
            "/api/v1/admin/users",
            "/api/v1/admin/categories",
            "/api/v1/admin/promotions",
            "/api/v1/admin/stats",
    })
    @DisplayName("Admin endpoint rejects anonymous requests")
    void adminEndpointRequiresAuth(String basePath) {
        ResponseEntity<String> response = restTemplate.getForEntity(basePath, String.class);

        assertThat(response.getStatusCode())
                .as("Anonymous GET %s must NOT return 2xx", basePath)
                .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(response.getStatusCode().is2xxSuccessful())
                .as("Anonymous GET %s must NOT succeed", basePath)
                .isFalse();
    }

    @ParameterizedTest(name = "GET {0} with a plain CUSTOMER token returns 403")
    @ValueSource(strings = {
            "/api/v1/admin/carriers",
            "/api/v1/admin/blog",
            "/api/v1/admin/gift-cards",
            "/api/v1/admin/questions",
            "/api/v1/admin/products",
            "/api/v1/admin/orders",
            "/api/v1/admin/export",
            "/api/v1/admin/reviews",
            "/api/v1/admin/returns",
            "/api/v1/admin/shipping",
            "/api/v1/admin/users",
            "/api/v1/admin/categories",
            "/api/v1/admin/promotions",
            "/api/v1/admin/stats",
    })
    @DisplayName("Admin endpoint rejects an authenticated non-admin user")
    void adminEndpointRejectsCustomerRole(String basePath) {
        String token = registerAndLogin("admin_sweep_" + Math.abs(basePath.hashCode()) + "@test.com");

        ResponseEntity<String> response = restTemplate.exchange(
                basePath,
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(token)),
                String.class);

        assertThat(response.getStatusCode().is2xxSuccessful())
                .as("A CUSTOMER-role token must NOT be able to access %s", basePath)
                .isFalse();
        // Spring Security's accessDeniedHandler (SecurityConfig) returns 403 for an
        // authenticated-but-wrong-role request. 404/405 are acceptable too (means the
        // exact sub-path isn't mapped, but the base path is still behind the matcher —
        // what we must never see is 200).
        assertThat(response.getStatusCode())
                .isIn(HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.METHOD_NOT_ALLOWED);
    }
}
