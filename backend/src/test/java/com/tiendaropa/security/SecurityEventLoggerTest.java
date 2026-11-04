package com.tiendaropa.security;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that SecurityEventLogger emits structured log events with the
 * expected format and severity level.
 *
 * Uses Logback's ListAppender to capture log output in-memory — no I/O,
 * no mocking framework required.
 */
class SecurityEventLoggerTest {

    private SecurityEventLogger logger;
    private ListAppender<ILoggingEvent> appender;
    private Logger logbackLogger;

    @BeforeEach
    void setUp() {
        logger = new SecurityEventLogger();

        logbackLogger = (Logger) LoggerFactory.getLogger(SecurityEventLogger.class);
        logbackLogger.setLevel(Level.DEBUG); // ensure INFO/WARN events are captured regardless of external config
        appender = new ListAppender<>();
        appender.start();
        logbackLogger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        logbackLogger.detachAppender(appender);
        logbackLogger.setLevel(null); // reset to inherit from parent
    }

    // ── Authentication events ─────────────────────────────────────────────────

    @Test
    void loginSuccess_logsInfoWithUserIdEmailAndIp() {
        logger.loginSuccess(1L, "user@test.com", "10.0.0.1");

        assertSingleEvent(Level.INFO, "LOGIN_SUCCESS", "userId=1", "user@test.com", "10.0.0.1");
    }

    @Test
    void loginFailed_logsWarnWithEmailIpAndReason() {
        logger.loginFailed("user@test.com", "10.0.0.1", "bad_credentials attempt=1");

        assertSingleEvent(Level.WARN, "LOGIN_FAILED", "user@test.com", "10.0.0.1", "bad_credentials");
    }

    @Test
    void accountLocked_logsWarnWithAttemptCount() {
        logger.accountLocked("user@test.com", 5, "10.0.0.1");

        assertSingleEvent(Level.WARN, "ACCOUNT_LOCKED", "user@test.com", "failedAttempts=5");
    }

    @Test
    void logout_logsInfoWithUserIdAndIp() {
        logger.logout(42L, "10.0.0.2");

        assertSingleEvent(Level.INFO, "LOGOUT", "userId=42", "10.0.0.2");
    }

    // ── Registration ──────────────────────────────────────────────────────────

    @Test
    void registered_logsInfoWithUserIdEmailAndIp() {
        logger.registered(7L, "new@test.com", "192.168.1.1");

        assertSingleEvent(Level.INFO, "REGISTER", "userId=7", "new@test.com", "192.168.1.1");
    }

    // ── Two-factor authentication ─────────────────────────────────────────────

    @Test
    void twoFactorEnabled_logsInfo() {
        logger.twoFactorEnabled(3L);

        assertSingleEvent(Level.INFO, "2FA_ENABLED", "userId=3");
    }

    @Test
    void twoFactorDisabled_logsInfo() {
        logger.twoFactorDisabled(3L);

        assertSingleEvent(Level.INFO, "2FA_DISABLED", "userId=3");
    }

    @Test
    void twoFactorFailed_logsWarn() {
        logger.twoFactorFailed(3L, "10.0.0.1");

        assertSingleEvent(Level.WARN, "2FA_FAILED", "userId=3");
    }

    @Test
    void twoFactorSuccess_logsInfo() {
        logger.twoFactorSuccess(3L, "10.0.0.1");

        assertSingleEvent(Level.INFO, "2FA_SUCCESS", "userId=3");
    }

    // ── Password ──────────────────────────────────────────────────────────────

    @Test
    void passwordResetRequested_logsInfo() {
        logger.passwordResetRequested("user@test.com", "10.0.0.1");

        assertSingleEvent(Level.INFO, "PASSWORD_RESET_REQUESTED", "user@test.com");
    }

    @Test
    void passwordResetCompleted_logsInfo() {
        logger.passwordResetCompleted(5L);

        assertSingleEvent(Level.INFO, "PASSWORD_RESET_COMPLETED", "userId=5");
    }

    // ── Token ─────────────────────────────────────────────────────────────────

    @Test
    void tokenRefreshed_logsInfo() {
        logger.tokenRefreshed(10L, "10.0.0.1");

        assertSingleEvent(Level.INFO, "TOKEN_REFRESHED", "userId=10");
    }

    @Test
    void tokenRevoked_logsInfo() {
        logger.tokenRevoked(10L, "jti-abc-123");

        assertSingleEvent(Level.INFO, "TOKEN_REVOKED", "userId=10", "jti-abc-123");
    }

    // ── All events carry the [SECURITY] marker ────────────────────────────────

    @Test
    void allEvents_carrySecurityPrefix() {
        logger.loginSuccess(1L, "a@b.com", "1.1.1.1");
        logger.loginFailed("a@b.com", "1.1.1.1", "bad_credentials");
        logger.logout(1L, "1.1.1.1");

        assertThat(appender.list)
                .allSatisfy(event ->
                        assertThat(event.getFormattedMessage()).contains("[SECURITY]"));
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private void assertSingleEvent(Level level, String... fragments) {
        assertThat(appender.list).hasSize(1);
        ILoggingEvent event = appender.list.get(0);
        assertThat(event.getLevel()).isEqualTo(level);
        String message = event.getFormattedMessage();
        for (String fragment : fragments) {
            assertThat(message).contains(fragment);
        }
    }
}
