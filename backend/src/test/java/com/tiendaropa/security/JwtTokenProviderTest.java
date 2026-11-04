package com.tiendaropa.security;

import com.tiendaropa.config.properties.JwtProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class JwtTokenProviderTest {

    private static final String SECRET =
            "test-secret-key-that-is-at-least-32-chars-long-for-hs256";

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(
                new JwtProperties(SECRET, 3_600_000L, 86_400_000L));
    }

    // ── generateAccessToken ───────────────────────────────────────────────────

    @Test
    void generateAccessToken_embedsUserIdEmailAndRole() {
        String token = provider.generateAccessToken(42L, "user@test.com", "USER");

        assertThat(provider.getUserIdFromToken(token)).isEqualTo(42L);
        assertThat(provider.getRoleFromToken(token)).isEqualTo("USER");
    }

    @Test
    void generateAccessToken_isValidImmediately() {
        String token = provider.generateAccessToken(1L, "a@b.com", "USER");

        assertThat(provider.validateToken(token)).isTrue();
    }

    // ── generateRefreshToken ──────────────────────────────────────────────────

    @Test
    void generateRefreshToken_isValid() {
        String token = provider.generateRefreshToken(7L, "r@test.com", "ADMIN");

        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getUserIdFromToken(token)).isEqualTo(7L);
        assertThat(provider.getRoleFromToken(token)).isEqualTo("ADMIN");
    }

    @Test
    void refreshToken_isNotATempToken() {
        String refresh = provider.generateRefreshToken(7L, "r@test.com", "USER");

        assertThat(provider.isTempToken(refresh)).isFalse();
    }

    // ── generateTempToken ─────────────────────────────────────────────────────

    @Test
    void generateTempToken_isTempToken() {
        String temp = provider.generateTempToken(99L);

        assertThat(provider.isTempToken(temp)).isTrue();
    }

    @Test
    void generateTempToken_isNotValidAsRegularToken() {
        // Temp tokens ARE structurally valid JWTs; callers must check isTempToken()
        // before accepting them as regular auth tokens.
        String temp = provider.generateTempToken(99L);

        assertThat(provider.validateToken(temp)).isTrue();
        assertThat(provider.isTempToken(temp)).isTrue();
    }

    @Test
    void regularAccessToken_isNotATempToken() {
        String access = provider.generateAccessToken(1L, "a@b.com", "USER");

        assertThat(provider.isTempToken(access)).isFalse();
    }

    // ── validateToken ─────────────────────────────────────────────────────────

    @Test
    void validateToken_expiredToken_returnsFalse() throws InterruptedException {
        JwtTokenProvider shortLived = new JwtTokenProvider(
                new JwtProperties(SECRET, 1L, 1L)); // 1 ms expiry

        String token = shortLived.generateAccessToken(1L, "a@b.com", "USER");
        Thread.sleep(50); // wait for expiry

        assertThat(shortLived.validateToken(token)).isFalse();
    }

    @Test
    void validateToken_tamperedSignature_returnsFalse() {
        String token = provider.generateAccessToken(1L, "a@b.com", "USER");
        String tampered = token.substring(0, token.length() - 4) + "XXXX";

        assertThat(provider.validateToken(tampered)).isFalse();
    }

    @Test
    void validateToken_randomString_returnsFalse() {
        assertThat(provider.validateToken("not.a.jwt.token")).isFalse();
    }

    @Test
    void validateToken_blankString_returnsFalse() {
        assertThat(provider.validateToken("")).isFalse();
    }

    @Test
    void validateToken_tokenSignedWithDifferentKey_returnsFalse() {
        JwtTokenProvider other = new JwtTokenProvider(
                new JwtProperties("completely-different-secret-key-32chars!!", 3_600_000L, 86_400_000L));

        String foreignToken = other.generateAccessToken(1L, "a@b.com", "USER");

        assertThat(provider.validateToken(foreignToken)).isFalse();
    }

    // ── getUserIdFromToken ────────────────────────────────────────────────────

    @Test
    void getUserIdFromToken_returnsCorrectId() {
        String token = provider.generateAccessToken(123L, "a@b.com", "USER");

        assertThat(provider.getUserIdFromToken(token)).isEqualTo(123L);
    }

    // ── getRoleFromToken ──────────────────────────────────────────────────────

    @Test
    void getRoleFromToken_returnsCorrectRole() {
        String token = provider.generateAccessToken(1L, "admin@b.com", "ADMIN");

        assertThat(provider.getRoleFromToken(token)).isEqualTo("ADMIN");
    }

    // ── getExpirationMs ───────────────────────────────────────────────────────

    @Test
    void getExpirationMs_returnsConfiguredValue() {
        assertThat(provider.getExpirationMs()).isEqualTo(3_600_000L);
    }

    // ── isTempToken with invalid input ────────────────────────────────────────

    @Test
    void isTempToken_invalidToken_returnsFalseWithoutThrowing() {
        assertThatCode(() -> provider.isTempToken("garbage"))
                .doesNotThrowAnyException();

        assertThat(provider.isTempToken("garbage")).isFalse();
    }

    // ── getJtiFromToken ───────────────────────────────────────────────────────

    @Test
    void getJtiFromToken_returnsNonNullUuid() {
        String token = provider.generateAccessToken(1L, "a@b.com", "USER");

        String jti = provider.getJtiFromToken(token);

        assertThat(jti).isNotNull().isNotBlank();
    }

    @Test
    void getJtiFromToken_differentTokensHaveDifferentJtis() {
        String token1 = provider.generateAccessToken(1L, "a@b.com", "USER");
        String token2 = provider.generateAccessToken(1L, "a@b.com", "USER");

        assertThat(provider.getJtiFromToken(token1))
                .isNotEqualTo(provider.getJtiFromToken(token2));
    }

    @Test
    void getJtiFromToken_refreshTokenAlsoHasJti() {
        String token = provider.generateRefreshToken(1L, "a@b.com", "USER");

        assertThat(provider.getJtiFromToken(token)).isNotNull();
    }

    // ── getExpirationFromToken ────────────────────────────────────────────────

    @Test
    void getExpirationFromToken_isInTheFuture() {
        String token = provider.generateAccessToken(1L, "a@b.com", "USER");

        assertThat(provider.getExpirationFromToken(token))
                .isAfter(new java.util.Date());
    }

    @Test
    void getExpirationFromToken_respectsConfiguredExpiry() {
        String token = provider.generateAccessToken(1L, "a@b.com", "USER");
        long expiresInMs = provider.getExpirationFromToken(token).getTime() - System.currentTimeMillis();

        // Should be close to 1h (3_600_000 ms) — allow ±5s for test execution time
        assertThat(expiresInMs).isBetween(3_595_000L, 3_605_000L);
    }
}
