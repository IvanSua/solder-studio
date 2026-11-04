package com.tiendaropa.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Propagates a X-Request-ID header through the request lifecycle.
 *
 * - If the client sends X-Request-ID, that value is reused (useful for
 *   frontend→backend tracing).
 * - If not present, a new UUID is generated.
 *
 * The ID is added to:
 *   1. SLF4J MDC as "requestId" — appears in every log line for this request.
 *   2. The response header X-Request-ID — so the frontend can correlate errors.
 *
 * Order(1) ensures this runs before Spring Security and other filters.
 */
@Component
@Order(1)
public class RequestIdFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "X-Request-ID";
    private static final String MDC_KEY     = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String requestId = request.getHeader(HEADER_NAME);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER_NAME, requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            // Always clean up MDC to prevent leakage across pooled threads
            MDC.remove(MDC_KEY);
        }
    }
}
