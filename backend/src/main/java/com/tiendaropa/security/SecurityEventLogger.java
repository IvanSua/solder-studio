package com.tiendaropa.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Structured logger for security-relevant events.
 *
 * <p>All events are emitted at INFO level under the "SECURITY" marker so they
 * can be routed to a dedicated audit appender (Splunk, ELK, CloudWatch, etc.)
 * independently of the application log.
 *
 * <p>Format: {@code [SECURITY] EVENT=<name> <key=value>...}
 */
@Component
@Slf4j
public class SecurityEventLogger {

    // ── Authentication ────────────────────────────────────────────────────────

    public void loginSuccess(Long userId, String email, String ip) {
        log.info("[SECURITY] EVENT=LOGIN_SUCCESS userId={} email={} ip={}", userId, email, ip);
    }

    public void loginFailed(String email, String ip, String reason) {
        log.warn("[SECURITY] EVENT=LOGIN_FAILED email={} ip={} reason={}", email, ip, reason);
    }

    public void accountLocked(String email, int attempts, String ip) {
        log.warn("[SECURITY] EVENT=ACCOUNT_LOCKED email={} failedAttempts={} ip={}", email, attempts, ip);
    }

    public void logout(Long userId, String ip) {
        log.info("[SECURITY] EVENT=LOGOUT userId={} ip={}", userId, ip);
    }

    // ── Registration ──────────────────────────────────────────────────────────

    public void registered(Long userId, String email, String ip) {
        log.info("[SECURITY] EVENT=REGISTER userId={} email={} ip={}", userId, email, ip);
    }

    // ── Two-Factor Authentication ─────────────────────────────────────────────

    public void twoFactorEnabled(Long userId) {
        log.info("[SECURITY] EVENT=2FA_ENABLED userId={}", userId);
    }

    public void twoFactorDisabled(Long userId) {
        log.info("[SECURITY] EVENT=2FA_DISABLED userId={}", userId);
    }

    public void twoFactorFailed(Long userId, String ip) {
        log.warn("[SECURITY] EVENT=2FA_FAILED userId={} ip={}", userId, ip);
    }

    public void twoFactorSuccess(Long userId, String ip) {
        log.info("[SECURITY] EVENT=2FA_SUCCESS userId={} ip={}", userId, ip);
    }

    // ── Password ──────────────────────────────────────────────────────────────

    public void passwordResetRequested(String email, String ip) {
        log.info("[SECURITY] EVENT=PASSWORD_RESET_REQUESTED email={} ip={}", email, ip);
    }

    public void passwordResetCompleted(Long userId) {
        log.info("[SECURITY] EVENT=PASSWORD_RESET_COMPLETED userId={}", userId);
    }

    // ── Token ─────────────────────────────────────────────────────────────────

    public void tokenRefreshed(Long userId, String ip) {
        log.info("[SECURITY] EVENT=TOKEN_REFRESHED userId={} ip={}", userId, ip);
    }

    public void tokenRevoked(Long userId, String jti) {
        log.info("[SECURITY] EVENT=TOKEN_REVOKED userId={} jti={}", userId, jti);
    }
}
