package com.tiendaropa.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TokenBlacklistServiceTest {

    private static final String KEY_PREFIX = "tienda:blacklist:";

    @Mock StringRedisTemplate redisTemplate;
    @Mock ValueOperations<String, String> valueOps;

    private TokenBlacklistService service;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        service = new TokenBlacklistService(redisTemplate);
    }

    // ── revoke — Redis available ───────────────────────────────────────────────

    @Nested
    class Revoke {

        @Test
        void revoke_storesJtiInRedisWithTtl() {
            Date expiration = new Date(System.currentTimeMillis() + 60_000);

            service.revoke("jti-abc", expiration);

            verify(valueOps).set(
                    eq(KEY_PREFIX + "jti-abc"),
                    eq("1"),
                    any(Duration.class));
        }

        @Test
        void revoke_alreadyExpiredToken_doesNotCallRedis() {
            Date expiration = new Date(System.currentTimeMillis() - 1_000); // in the past

            service.revoke("jti-expired", expiration);

            verify(valueOps, never()).set(anyString(), anyString(), any(Duration.class));
        }

        @Test
        void revoke_redisThrows_fallsBackToLocalStore() {
            Date expiration = new Date(System.currentTimeMillis() + 60_000);
            doThrow(new RuntimeException("Redis down"))
                    .when(valueOps).set(anyString(), anyString(), any(Duration.class));

            // Should not throw — falls back to in-memory
            service.revoke("jti-fallback", expiration);

            // Verify the token is now revoked via local store
            when(redisTemplate.hasKey(anyString())).thenThrow(new RuntimeException("Redis down"));
            assertThat(service.isRevoked("jti-fallback")).isTrue();
        }
    }

    // ── isRevoked — Redis available ───────────────────────────────────────────

    @Nested
    class IsRevoked {

        @Test
        void isRevoked_keyExistsInRedis_returnsTrue() {
            when(redisTemplate.hasKey(KEY_PREFIX + "jti-123")).thenReturn(Boolean.TRUE);

            assertThat(service.isRevoked("jti-123")).isTrue();
        }

        @Test
        void isRevoked_keyAbsentFromRedis_returnsFalse() {
            when(redisTemplate.hasKey(KEY_PREFIX + "jti-missing")).thenReturn(Boolean.FALSE);

            assertThat(service.isRevoked("jti-missing")).isFalse();
        }

        @Test
        void isRevoked_redisReturnsNull_returnsFalse() {
            when(redisTemplate.hasKey(anyString())).thenReturn(null);

            assertThat(service.isRevoked("jti-null")).isFalse();
        }

        @Test
        void isRevoked_redisThrows_checksLocalFallback_returnsFalseWhenAbsent() {
            when(redisTemplate.hasKey(anyString())).thenThrow(new RuntimeException("Redis down"));

            // Nothing in local fallback — should return false
            assertThat(service.isRevoked("jti-unknown")).isFalse();
        }

        @Test
        void isRevoked_redisThrows_checksLocalFallback_returnsTrueWhenPresent() {
            // Revoke via Redis (which will fail and go to local store)
            Date expiration = new Date(System.currentTimeMillis() + 60_000);
            doThrow(new RuntimeException("Redis down"))
                    .when(valueOps).set(anyString(), anyString(), any(Duration.class));
            service.revoke("jti-local", expiration);

            // Now isRevoked with Redis also down
            when(redisTemplate.hasKey(anyString())).thenThrow(new RuntimeException("Redis down"));

            assertThat(service.isRevoked("jti-local")).isTrue();
        }

        @Test
        void isRevoked_expiredLocalEntry_returnsFalseAndEvicts() throws InterruptedException {
            // Revoke via fallback with very short expiry
            doThrow(new RuntimeException("Redis down"))
                    .when(valueOps).set(anyString(), anyString(), any(Duration.class));
            service.revoke("jti-short", new Date(System.currentTimeMillis() + 50));

            Thread.sleep(100); // wait for local entry to expire

            when(redisTemplate.hasKey(anyString())).thenThrow(new RuntimeException("Redis down"));
            assertThat(service.isRevoked("jti-short")).isFalse();
        }
    }
}
