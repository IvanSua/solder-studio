package com.tiendaropa.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for GlobalExceptionHandler.
 *
 * Calls handler methods directly — no Spring context needed.
 * The response body contract: { timestamp, status (int), error (String) }.
 */
class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    // ── ResourceNotFoundException → 404 ───────────────────────────────────────

    @Test
    void handleNotFound_returns404WithMessage() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleNotFound(new ResourceNotFoundException("Order not found"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("status", 404);
        assertThat(response.getBody()).containsEntry("error", "Order not found");
        assertThat(response.getBody()).containsKey("timestamp");
    }

    // ── InsufficientStockException → 409 ─────────────────────────────────────

    @Test
    void handleInsufficientStock_returns409() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleInsufficientStock(new InsufficientStockException("Out of stock"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("status", 409);
    }

    // ── BusinessException → custom status ────────────────────────────────────

    @Test
    void handleBusiness_usesExceptionStatus() {
        BusinessException ex = new BusinessException("Email already registered", HttpStatus.CONFLICT);

        ResponseEntity<Map<String, Object>> response = handler.handleBusiness(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("status", 409);
        assertThat(response.getBody()).containsEntry("error", "Email already registered");
    }

    @Test
    void handleBusiness_401_returns401() {
        BusinessException ex = new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED);

        ResponseEntity<Map<String, Object>> response = handler.handleBusiness(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("status", 401);
    }

    // ── IllegalStateException → 400 ──────────────────────────────────────────

    @Test
    void handleIllegalState_returns400() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleIllegalState(new IllegalStateException("Order already cancelled"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", 400);
        assertThat(response.getBody()).containsEntry("error", "Order already cancelled");
    }

    // ── IllegalArgumentException → 400 ───────────────────────────────────────

    @Test
    void handleIllegalArgument_returns400() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleIllegalArgument(new IllegalArgumentException("Invalid page size"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", 400);
    }

    // ── AccessDeniedException → 403 ──────────────────────────────────────────

    @Test
    void handleAccessDenied_returns403() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleAccessDenied(new AccessDeniedException("forbidden"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("status", 403);
        assertThat(response.getBody()).containsEntry("error", "Acceso denegado");
    }

    // ── MaxUploadSizeExceededException → 413 ─────────────────────────────────

    @Test
    void handleMaxUpload_returns413() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleMaxUpload(new MaxUploadSizeExceededException(10 * 1024 * 1024));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
        assertThat(response.getBody()).containsEntry("status", 413);
    }

    // ── DataIntegrityViolationException → 409 with specific messages ──────────

    @Test
    void handleDataIntegrity_emailViolation_returns409WithEmailMessage() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"users_email_key\"");

        ResponseEntity<Map<String, Object>> response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("error").toString()).contains("email");
    }

    @Test
    void handleDataIntegrity_skuViolation_returns409WithSkuMessage() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"variants_sku_key\"");

        ResponseEntity<Map<String, Object>> response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("error").toString()).contains("SKU");
    }

    @Test
    void handleDataIntegrity_slugViolation_returns409WithSlugMessage() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"products_slug_key\"");

        ResponseEntity<Map<String, Object>> response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("error").toString()).contains("slug");
    }

    @Test
    void handleDataIntegrity_unknownViolation_returnsGenericMessage() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "some other constraint violation");

        ResponseEntity<Map<String, Object>> response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ── Generic Exception → 500 ───────────────────────────────────────────────

    @Test
    void handleGeneral_returns500() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleGeneral(new RuntimeException("unexpected"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("status", 500);
        assertThat(response.getBody()).containsEntry("error", "Internal server error");
    }

    // ── Response body structure ───────────────────────────────────────────────

    @Test
    void allResponses_containTimestampAndStatusAndError() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleNotFound(new ResourceNotFoundException("x"));

        assertThat(response.getBody()).containsKeys("timestamp", "status", "error");
    }
}
