package com.tiendaropa.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages a blacklist of revoked JWT tokens.
 *
 * <p>Each entry is stored by JTI (JWT ID) with a TTL equal to the token's remaining
 * lifetime so Redis auto-expires entries — no manual cleanup needed.
 *
 * <p>Falls back to in-memory {@link ConcurrentHashMap} when Redis is unavailable
 * (same strategy as {@code RedisConfig}). In multi-instance deployments Redis is
 * required for the blacklist to be consistent across nodes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TokenBlacklistService {

    private static final String KEY_PREFIX = "tienda:blacklist:";

    private final StringRedisTemplate stringRedisTemplate;

    /** In-memory fallback when Redis is unreachable. */
    private final ConcurrentHashMap<String, Long> localBlacklist = new ConcurrentHashMap<>();

    /**
     * Revokes a token by adding its JTI to the blacklist.
     * The entry expires automatically when the token would have expired.
     *
     * @param jti        JWT ID extracted from the token
     * @param expiration token expiration date (used to compute TTL)
     */
    public void revoke(String jti, Date expiration) {
        long ttlSeconds = Duration.between(Instant.now(), expiration.toInstant()).getSeconds();
        if (ttlSeconds <= 0) return; // already expired — nothing to blacklist

        try {
            stringRedisTemplate.opsForValue()
                    .set(KEY_PREFIX + jti, "1", Duration.ofSeconds(ttlSeconds));
        } catch (Exception ex) {
            log.warn("Redis unavailable — using in-memory blacklist for jti={}", jti);
            localBlacklist.put(jti, expiration.getTime());
        }
    }

    /**
     * Returns {@code true} if the given JTI has been revoked.
     */
    public boolean isRevoked(String jti) {
        try {
            return Boolean.TRUE.equals(stringRedisTemplate.hasKey(KEY_PREFIX + jti));
        } catch (Exception ex) {
            log.warn("Redis unavailable — checking in-memory blacklist for jti={}", jti);
            Long exp = localBlacklist.get(jti);
            if (exp == null) return false;
            if (System.currentTimeMillis() > exp) {
                localBlacklist.remove(jti);
                return false;
            }
            return true;
        }
    }
}
