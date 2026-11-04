package com.tiendaropa.integration;

import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.dto.response.CartResponse;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test: auth → cart flow against a real PostgreSQL database.
 *
 * Uses Testcontainers to spin up a PostgreSQL 16 container so the tests run
 * against the same DB engine as production. Flyway migrations are applied
 * automatically, validating V1/V2/V3 scripts against a real Postgres instance.
 *
 * Redis is not required — RedisConfig falls back to in-memory cache.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthAndCartIntegrationTest extends BaseIntegrationTest {

    // ── 1. Registration ───────────────────────────────────────────────────────

    @Test
    @Order(1)
    void registerNewUser_returns201WithToken() {
        RegisterRequest req = buildRegisterRequest("integration@test.com");

        ResponseEntity<AuthResponse> response =
                restTemplate.postForEntity("/api/v1/auth/register", req, AuthResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getAccessToken()).isNotBlank();
        assertThat(response.getBody().getUser().getEmail()).isEqualTo("integration@test.com");
    }

    @Test
    @Order(2)
    void registerDuplicateEmail_returns409() {
        RegisterRequest req = buildRegisterRequest("duplicate@test.com");

        restTemplate.postForEntity("/api/v1/auth/register", req, AuthResponse.class);

        ResponseEntity<String> conflict =
                restTemplate.postForEntity("/api/v1/auth/register", req, String.class);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ── 2. Login ──────────────────────────────────────────────────────────────

    @Test
    @Order(3)
    void login_returnsJwt() {
        restTemplate.postForEntity("/api/v1/auth/register",
                buildRegisterRequest("login@test.com"), AuthResponse.class);

        LoginRequest login = new LoginRequest();
        login.setEmail("login@test.com");
        login.setPassword("password123");

        ResponseEntity<AuthResponse> response =
                restTemplate.postForEntity("/api/v1/auth/login", login, AuthResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getAccessToken()).isNotBlank();
    }

    @Test
    @Order(4)
    void login_withWrongPassword_returns401() {
        restTemplate.postForEntity("/api/v1/auth/register",
                buildRegisterRequest("badpwd@test.com"), AuthResponse.class);

        LoginRequest login = new LoginRequest();
        login.setEmail("badpwd@test.com");
        login.setPassword("WRONG_PASSWORD");

        ResponseEntity<String> response =
                restTemplate.postForEntity("/api/v1/auth/login", login, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── 3. Cart ───────────────────────────────────────────────────────────────

    @Test
    @Order(5)
    void getCart_withoutToken_returns401() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/cart", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @Order(6)
    void getCart_withValidToken_returnsEmptyCart() {
        String token = registerAndLogin("cart@test.com");

        ResponseEntity<CartResponse> response = restTemplate.exchange(
                "/api/v1/cart", HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(token)), CartResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getItems()).isEmpty();
    }

    // ── 4. Product listing (public) ───────────────────────────────────────────

    @Test
    @Order(7)
    void listProducts_isPublic_returnsEmptyPage() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/products", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"content\"");
        assertThat(response.getBody()).contains("\"totalElements\"");
    }
}
