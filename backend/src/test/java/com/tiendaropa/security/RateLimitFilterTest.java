package com.tiendaropa.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Unit tests for RateLimitFilter.
 *
 * Uses Spring's MockHttpServletRequest/Response — no application context required.
 * Each test gets a fresh filter instance so bucket state never leaks between tests.
 * ProxyManager is null (in-memory fallback) to keep tests fast and Redis-free.
 */
class RateLimitFilterTest {

    private RateLimitFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        // null ProxyManager → uses local in-memory buckets (fallback mode)
        // args: login=10 register=5 forgotPassword=5 payments=30 global=300 trustedProxyHops=1
        filter = new RateLimitFilter(10, 5, 5, 30, 300, 1, null);
        chain  = mock(FilterChain.class);
    }

    // ── shouldNotFilter ───────────────────────────────────────────────────────

    @Test
    void getRequest_toAuthLogin_isStillFiltered() throws Exception {
        // GET isn't one of the tightly-limited auth verbs, but every route now falls
        // under the global fallback bucket — a single request must still pass through.
        MockHttpServletRequest req = request("GET", "/api/v1/auth/login");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertThat(res.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void healthCheck_isNeverFiltered() throws Exception {
        MockHttpServletRequest req = request("GET", "/actuator/health/liveness");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertThat(res.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void optionsPreflight_isNeverFiltered() throws Exception {
        MockHttpServletRequest req = request("OPTIONS", "/api/v1/auth/login");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertThat(res.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void routeOutsideSensitiveList_stillGetsGlobalLimit() throws Exception {
        // Previously these routes had NO limit at all. Now they fall under the
        // global per-IP bucket (300/min in this test setup) — a flood eventually 429s.
        exhaust("POST", "/api/v1/orders/1/cancel", 300);

        assertThat(fire("POST", "/api/v1/orders/1/cancel").getStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void singleRequestToUnmonitoredPath_passesThrough() throws Exception {
        MockHttpServletRequest req = request("POST", "/api/v1/orders/1/cancel");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertThat(res.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── login rate limit (10 / min) ───────────────────────────────────────────

    @Test
    void loginEndpoint_withinLimit_passesThrough() throws Exception {
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
            MockHttpServletResponse res = new MockHttpServletResponse();

            filter.doFilter(req, res, chain);

            assertThat(res.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        }
    }

    @Test
    void loginEndpoint_exceedsLimit_returns429() throws Exception {
        exhaust("POST", "/api/v1/auth/login", 10);

        MockHttpServletResponse res = fire("POST", "/api/v1/auth/login");

        assertThat(res.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(res.getContentType()).contains("application/json");
    }

    // ── register rate limit (5 / min) ────────────────────────────────────────

    @Test
    void registerEndpoint_exceedsLimit_returns429() throws Exception {
        exhaust("POST", "/api/v1/auth/register", 5);

        assertThat(fire("POST", "/api/v1/auth/register").getStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── forgot-password rate limit (5 / min) ─────────────────────────────────

    @Test
    void forgotPassword_exceedsLimit_returns429() throws Exception {
        exhaust("POST", "/api/v1/auth/forgot-password", 5);

        assertThat(fire("POST", "/api/v1/auth/forgot-password").getStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── payments rate limit (30 / min) ───────────────────────────────────────

    @Test
    void paymentsEndpoint_exceedsLimit_returns429() throws Exception {
        exhaust("POST", "/api/v1/payments/webhook", 30);

        assertThat(fire("POST", "/api/v1/payments/webhook").getStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── IP isolation — different IPs have separate buckets ───────────────────

    @Test
    void differentIps_haveIndependentBuckets() throws Exception {
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = request("POST", "/api/v1/auth/register");
            req.addHeader("X-Forwarded-For", "1.1.1.1");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }

        MockHttpServletRequest req2 = request("POST", "/api/v1/auth/register");
        req2.addHeader("X-Forwarded-For", "2.2.2.2");
        MockHttpServletResponse res2 = new MockHttpServletResponse();

        filter.doFilter(req2, res2, chain);

        assertThat(res2.getStatus()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── IP resolution ─────────────────────────────────────────────────────────

    @Test
    void resolveClientIp_usesLastTrustedHop_notClientSuppliedFirstEntry() throws Exception {
        // trustedProxyHops=1 → only the LAST entry (appended by our own edge proxy) is
        // trusted. The first entry is attacker-controlled and must be ignored, otherwise
        // a client could spoof a new "X-Forwarded-For: <random>, 10.0.0.1" on every
        // request and get a fresh bucket each time, bypassing the limit entirely.
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
            req.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.1");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }

        MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
        req.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void resolveClientIp_spoofedFirstHop_cannotBypassLimit() throws Exception {
        // Exhaust the bucket for real client IP 10.0.0.1 (the trusted last hop).
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
            req.addHeader("X-Forwarded-For", "1.1.1.1, 10.0.0.1");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }

        // Attacker changes the fake first hop on every request — the real (last) hop
        // is unchanged, so this must still be blocked.
        MockHttpServletRequest spoofed = request("POST", "/api/v1/auth/login");
        spoofed.addHeader("X-Forwarded-For", "9.9.9.9, 10.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(spoofed, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void resolveClientIp_usesXRealIpWhenNoXFF() throws Exception {
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
            req.addHeader("X-Real-IP", "198.51.100.7");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }

        MockHttpServletRequest req = request("POST", "/api/v1/auth/login");
        req.addHeader("X-Real-IP", "198.51.100.7");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    // ── 429 response body ─────────────────────────────────────────────────────

    @Test
    void rateLimitedResponse_containsJsonErrorMessage() throws Exception {
        exhaust("POST", "/api/v1/auth/login", 10);

        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(request("POST", "/api/v1/auth/login"), res, chain);

        assertThat(res.getContentAsString()).contains("error");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private MockHttpServletRequest request(String method, String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod(method);
        req.setRequestURI(uri);
        req.setRemoteAddr("127.0.0.1");
        return req;
    }

    private void exhaust(String method, String path, int times) throws Exception {
        for (int i = 0; i < times; i++) {
            filter.doFilter(request(method, path), new MockHttpServletResponse(), chain);
        }
    }

    private MockHttpServletResponse fire(String method, String path) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(request(method, path), res, chain);
        return res;
    }
}
