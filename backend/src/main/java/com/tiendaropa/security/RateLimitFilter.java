package com.tiendaropa.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * IP-based rate limiter using the Bucket4j token-bucket algorithm.
 *
 * <p>Two layers of limits per client IP:
 * <ul>
 *   <li>Tight, endpoint-specific limits for sensitive routes:
 *       POST /api/v1/auth/login, /auth/register, /auth/forgot-password, /payments/**</li>
 *   <li>A global fallback limit applied to <b>every other route</b> (catalog, cart,
 *       checkout, admin, etc.) — configurable, default 300 req/min per IP. Without this,
 *       any route outside the four listed above had no protection at all against a
 *       flood of requests from a single source.</li>
 * </ul>
 *
 * <p>Uses a Redis-backed {@link ProxyManager} when available for consistent rate
 * limiting across multiple application instances. Falls back to in-memory
 * {@link ConcurrentHashMap} buckets when Redis is unreachable.
 *
 * <p><b>Scope:</b> this protects against single-source floods and credential-stuffing
 * from one IP. It does NOT stop a distributed flood coming from many different IPs —
 * that requires infra-level protection in front of the app (Railway/Cloudflare).
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final String PREFIX = "tienda:rl:";

    private final int loginLimit;
    private final int registerLimit;
    private final int forgotPasswordLimit;
    private final int paymentsLimit;
    private final int globalLimit;
    private final int trustedProxyHops;

    @Nullable
    private final ProxyManager<byte[]> proxyManager;

    /** In-memory fallback buckets, keyed by "endpoint:ip". */
    private final Map<String, Bucket> localBuckets = new ConcurrentHashMap<>();

    public RateLimitFilter(int loginLimit, int registerLimit, int forgotPasswordLimit,
                           int paymentsLimit, int globalLimit, int trustedProxyHops,
                           @Nullable ProxyManager<byte[]> proxyManager) {
        this.loginLimit          = loginLimit;
        this.registerLimit       = registerLimit;
        this.forgotPasswordLimit = forgotPasswordLimit;
        this.paymentsLimit       = paymentsLimit;
        this.globalLimit         = globalLimit;
        this.trustedProxyHops    = trustedProxyHops;
        this.proxyManager        = proxyManager;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String method = request.getMethod();
        String path   = request.getRequestURI();
        // CORS preflight is automatic browser behavior, not user-driven traffic — skip it.
        if ("OPTIONS".equalsIgnoreCase(method)) return true;
        // Health/liveness probes (Railway, Docker healthcheck) must never be throttled.
        return path.startsWith("/actuator/health");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        String ip   = resolveClientIp(request);
        String path = request.getRequestURI();

        Bucket bucket = resolveBucket(ip, path, request.getMethod());
        // Note: resolveBucket() itself decides IP-vs-user keying per bucket type — see
        // resolveGlobalIdentity() below.

        if (bucket != null && !bucket.tryConsume(1)) {
            log.warn("Rate limit exceeded for IP {} on {}", ip, path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"error\":\"Demasiadas solicitudes. Esperá un momento antes de intentar de nuevo.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private Bucket resolveBucket(String ip, String path, String method) {
        if ("POST".equalsIgnoreCase(method)) {
            if (path.startsWith("/api/v1/auth/login")) {
                return getBucket("login", ip, loginLimit);
            }
            if (path.startsWith("/api/v1/auth/register")) {
                return getBucket("register", ip, registerLimit);
            }
            if (path.startsWith("/api/v1/auth/forgot-password")) {
                return getBucket("forgot", ip, forgotPasswordLimit);
            }
            // Guest checkout creates a (lightweight) account under the hood, same
            // abuse profile as /auth/register — same limit, always IP-keyed since
            // there's no authenticated identity at this point.
            if (path.startsWith("/api/v1/checkout/guest")) {
                return getBucket("guestCheckout", ip, registerLimit);
            }
        }
        if (path.startsWith("/api/v1/payments")) {
            return getBucket("payments", ip, paymentsLimit);
        }
        // Fallback: every other route (catalog, cart, checkout, admin, etc.).
        // Keyed by authenticated userId when there is one — so an authenticated
        // user isn't affected by other people sharing their IP (office NAT), and
        // can't dodge the limit just by switching networks. Anonymous requests
        // still fall back to per-IP, same as before.
        return getBucket("global", resolveGlobalIdentity(ip), globalLimit);
    }

    /**
     * Returns "u:<userId>" when the request carries an authenticated JWT principal
     * (RateLimitFilter runs AFTER JwtAuthenticationFilter — see SecurityConfig — so
     * SecurityContextHolder is already populated at this point), otherwise falls
     * back to the raw client IP.
     */
    private String resolveGlobalIdentity(String ip) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Long userId) {
            return "u:" + userId;
        }
        return ip;
    }

    /**
     * Returns a distributed bucket from Redis when the proxy manager is available,
     * otherwise falls back to a local in-memory bucket.
     */
    private Bucket getBucket(String endpoint, String ip, int limit) {
        String key = endpoint + ":" + ip;
        Supplier<BucketConfiguration> config = () -> BucketConfiguration.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limit)
                        .refillGreedy(limit, Duration.ofMinutes(1))
                        .build())
                .build();

        if (proxyManager != null) {
            try {
                return proxyManager.builder()
                        .build((PREFIX + key).getBytes(StandardCharsets.UTF_8), config);
            } catch (Exception ex) {
                log.warn("Redis bucket unavailable for key={}, using local fallback: {}", key, ex.getMessage());
            }
        }

        return localBuckets.computeIfAbsent(key, k -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limit)
                        .refillGreedy(limit, Duration.ofMinutes(1))
                        .build())
                .build());
    }

    /**
     * Resolves the client IP without blindly trusting client-supplied headers.
     *
     * <p>X-Forwarded-For is a comma-separated hop chain: "client, proxy1, proxy2, ...".
     * Each proxy APPENDS the IP it observed to the end of the list — it never rewrites
     * earlier entries. A malicious client can freely set an initial fake value
     * ("X-Forwarded-For: 1.2.3.4"), but cannot fake the entry the trusted edge proxy
     * appends. Reading from the FRONT of the list (as before) let anyone spoof their
     * rate-limit identity on every request; this reads from {@code trustedProxyHops}
     * positions from the END instead, which only the trusted proxy controls.
     *
     * <p>{@code trustedProxyHops} must match the number of proxies actually in front of
     * the app (Railway/Render edge = 1). If it's set to 0 (no proxy in front), the
     * header is ignored entirely and {@code request.getRemoteAddr()} is used.
     */
    private String resolveClientIp(HttpServletRequest request) {
        if (trustedProxyHops <= 0) {
            return request.getRemoteAddr();
        }

        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] hops = xff.split(",");
            int index = hops.length - trustedProxyHops;
            if (index >= 0 && index < hops.length) {
                return hops[index].trim();
            }
            // Chain shorter than expected — fall back to the earliest hop we do have
            // rather than trusting an attacker-controlled position.
            return hops[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
