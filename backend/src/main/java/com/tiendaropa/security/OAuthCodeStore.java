package com.tiendaropa.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * One-time code store for the OAuth2 token exchange flow.
 *
 * <p>Instead of passing the JWT directly as a query parameter (which exposes it
 * in browser history, server logs, and Referer headers), the success handler
 * generates a short-lived code that the frontend exchanges for real tokens via
 * POST /api/v1/auth/oauth-exchange.
 *
 * <p>Each code:
 * <ul>
 *   <li>is a UUID (unguessable)</li>
 *   <li>expires in {@link #TTL_SECONDS} seconds</li>
 *   <li>is consumed exactly once (atomic GET+DEL via Lua script)</li>
 * </ul>
 *
 * <p>Uses Redis as the primary store. Falls back to in-memory when Redis is
 * unavailable (single-instance only — not safe for multi-instance deployments).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuthCodeStore {

    private static final int TTL_SECONDS = 30;
    private static final String KEY_PREFIX = "tienda:oauth:code:";

    /**
     * Atomic GET + DEL: returns the value and deletes the key in a single round-trip.
     * Returns nil (null) if the key does not exist.
     */
    private static final DefaultRedisScript<String> GET_AND_DEL_SCRIPT =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]); " +
                    "if v then redis.call('DEL', KEYS[1]) end; " +
                    "return v",
                    String.class);

    private final StringRedisTemplate redisTemplate;

    /** In-memory fallback when Redis is unreachable. */
    private final ConcurrentHashMap<String, Entry> localStore = new ConcurrentHashMap<>();

    private record Entry(Long userId, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }

    /**
     * Generates a one-time code for the given user and stores it for {@value #TTL_SECONDS} seconds.
     */
    public String generateCode(Long userId) {
        String code = UUID.randomUUID().toString();
        try {
            redisTemplate.opsForValue()
                    .set(KEY_PREFIX + code, userId.toString(), TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception ex) {
            log.warn("Redis unavailable — storing OAuth code in memory: {}", ex.getMessage());
            localStore.put(code, new Entry(userId, Instant.now().plusSeconds(TTL_SECONDS)));
        }
        return code;
    }

    /**
     * Atomically consumes a code and returns the associated user ID,
     * or empty if the code is unknown, already used, or expired.
     */
    public Optional<Long> consume(String code) {
        try {
            String value = redisTemplate.execute(
                    GET_AND_DEL_SCRIPT,
                    List.of(KEY_PREFIX + code));
            if (value == null) return Optional.empty();
            return Optional.of(Long.parseLong(value));
        } catch (Exception ex) {
            log.warn("Redis unavailable — checking in-memory OAuth store: {}", ex.getMessage());
            Entry entry = localStore.remove(code);
            if (entry == null || entry.isExpired()) return Optional.empty();
            return Optional.of(entry.userId());
        }
    }

    /** Removes expired entries from the local fallback store every minute. */
    @Scheduled(fixedDelay = 60_000)
    void evictExpired() {
        localStore.entrySet().removeIf(e -> e.getValue().isExpired());
    }
}
