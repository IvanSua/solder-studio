package com.tiendaropa.integration;

import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.response.AuthResponse;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Base class for integration tests.
 *
 * Starts a single PostgreSQL 16 container shared across all subclasses
 * (static container — Testcontainers reuses it via container lifecycle).
 * Flyway migrations are applied automatically on startup.
 *
 * Redis is not required: RedisConfig falls back to in-memory cache
 * when no Redis is reachable (see RedisConfig.cacheManager).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("test")
public abstract class BaseIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("tiendaropa_test")
                    .withUsername("test")
                    .withPassword("test");

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",                postgres::getJdbcUrl);
        registry.add("spring.datasource.username",           postgres::getUsername);
        registry.add("spring.datasource.password",           postgres::getPassword);
        registry.add("spring.datasource.driver-class-name",  () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled",                () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto",        () -> "validate");
        registry.add("spring.jpa.database-platform",
                () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Autowired
    protected TestRestTemplate restTemplate;

    // ── Auth helpers ──────────────────────────────────────────────────────────

    protected String registerAndLogin(String email) {
        RegisterRequest reg = new RegisterRequest();
        reg.setEmail(email);
        reg.setPassword("password123");
        reg.setFirstName("Test");
        reg.setLastName("User");

        restTemplate.postForEntity("/api/v1/auth/register", reg, AuthResponse.class);

        LoginRequest login = new LoginRequest();
        login.setEmail(email);
        login.setPassword("password123");

        AuthResponse auth = restTemplate
                .postForEntity("/api/v1/auth/login", login, AuthResponse.class)
                .getBody();

        assertThat(auth).isNotNull();
        return auth.getAccessToken();
    }

    protected HttpHeaders bearerHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        return headers;
    }

    protected RegisterRequest buildRegisterRequest(String email) {
        RegisterRequest req = new RegisterRequest();
        req.setEmail(email);
        req.setPassword("password123");
        req.setFirstName("Test");
        req.setLastName("User");
        return req;
    }
}
