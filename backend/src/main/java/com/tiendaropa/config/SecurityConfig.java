package com.tiendaropa.config;

import io.github.bucket4j.distributed.proxy.ProxyManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.properties.AuthProperties;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.security.RateLimitFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final ObjectMapper objectMapper;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2AuthenticationSuccessHandler oAuth2SuccessHandler;
    private final AuthProperties authProperties;

    private final java.util.Optional<ProxyManager<byte[]>> bucketProxyManager;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    // Credentials for scraping /actuator/prometheus and /actuator/metrics/**.
    // DEV ONLY fallback below — set ACTUATOR_METRICS_USERNAME/PASSWORD in production
    // (e.g. as Railway variables) and point your Prometheus scrape config's
    // basic_auth at the same values. Without this, metrics endpoints previously
    // required a user JWT, which Prometheus can never supply — the monitoring
    // stack could not actually scrape the app in any environment.
    @Value("${app.actuator.metrics-username:prometheus}")
    private String actuatorMetricsUsername;

    @Value("${app.actuator.metrics-password:dev-only-change-in-production}")
    private String actuatorMetricsPassword;

    /**
     * Separate, higher-priority filter chain for the metrics scrape endpoints.
     * These are consumed by Prometheus (a machine, not a logged-in user), so they
     * use HTTP Basic with a dedicated low-privilege credential instead of JWT.
     * Must be declared with a lower @Order value than {@link #filterChain} so it
     * takes precedence for the paths it matches.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain actuatorMetricsFilterChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher("/actuator/prometheus", "/actuator/metrics/**")
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    // Deliberately does NOT take the app's shared PasswordEncoder bean as a parameter.
    // Spring Security's InitializeUserDetailsBeanManagerConfigurer resolves every
    // UserDetailsService-compatible bean SYNCHRONOUSLY and EAGERLY while building the
    // default AuthenticationManager — which itself happens as a side effect of building
    // the HttpSecurity bean for ANY @Bean SecurityFilterChain method (including the
    // unrelated `filterChain` below). That resolution calls getBean(...) directly, which
    // forces real construction immediately and is NOT deferred by @Lazy (kept anyway as
    // harmless documentation of intent — it does nothing here in practice). Concretely:
    // any @WebMvcTest slice that mocks PasswordEncoder without stubbing .encode() would
    // return null from passwordEncoder.encode(...), and Spring Security's User builder
    // rejects a null password with IllegalArgumentException, killing the whole
    // ApplicationContext — even for test classes that have nothing to do with actuator
    // metrics. This bean only exists to gate /actuator/prometheus and /actuator/metrics/**
    // behind a dedicated low-privilege Basic-auth credential, so it has no reason to share
    // the app's configured (and commonly mocked-in-tests) PasswordEncoder bean at all — a
    // private, locally-owned BCryptPasswordEncoder instance decouples it completely.
    @Bean
    @Lazy
    public InMemoryUserDetailsManager actuatorUserDetailsService() {
        UserDetails metricsUser = User.withUsername(actuatorMetricsUsername)
                .password(new BCryptPasswordEncoder().encode(actuatorMetricsPassword))
                .roles("METRICS")
                .build();
        return new InMemoryUserDetailsManager(metricsUser);
    }

    @Bean
    @Order(2)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31_536_000)
                    .includeSubDomains(true))
                .contentTypeOptions(ct -> {})
                .frameOptions(fo -> fo.deny())
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: https:; " +
                    "font-src 'self'; " +
                    "connect-src 'self'; " +
                    "frame-ancestors 'none'"
                ))
            )
            // STATELESS for regular JWT auth; sessions are still created when needed
            // by the OAuth2 authorization code flow (state parameter).
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                // ── Public endpoints ──────────────────────────────────
                .requestMatchers("/sitemap.xml", "/robots.txt").permitAll()
                // Actuator — health/info públicos; metrics requiere auth
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/actuator/info").permitAll()
                // Swagger UI / OpenAPI — rutas permitidas solo en dev/test.
                // En prod, springdoc.api-docs.enabled=false desactiva estos endpoints
                // a nivel de framework (devuelven 404), así que este permit es inocuo.
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**").permitAll()
                .requestMatchers("/api-docs/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/push/vapid-public-key").permitAll()
                // OAuth2 redirect endpoints must be public
                .requestMatchers("/login/oauth2/**", "/oauth2/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/promotions/active").permitAll()
                .requestMatchers("/api/v1/payments/webhook").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/suggestions").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/events/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/blog/**").permitAll()
                // Q&A read is public; write requires auth (handled by anyRequest().authenticated() below)
                .requestMatchers(HttpMethod.GET, "/api/v1/products/*/questions").permitAll()

                // ── Shipping — cálculo de tarifas es público ──────────
                .requestMatchers(HttpMethod.GET, "/api/v1/shipping/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/store/payment-config").permitAll()

                // ── Newsletter — subscribe/unsubscribe son públicos ────
                .requestMatchers(HttpMethod.POST, "/api/v1/newsletter/subscribe").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/newsletter/unsubscribe").permitAll()

                // ── Checkout de invitado — público (crea una cuenta "guest" ─
                // internamente, ver GuestCheckoutService). El resto de /checkout
                // sigue requiriendo autenticación (regla anyRequest() de abajo).
                .requestMatchers(HttpMethod.POST, "/api/v1/checkout/guest").permitAll()

                // ── Admin-only endpoints ──────────────────────────────
                .requestMatchers("/api/v1/admin/users/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/admin/roles/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/admin/stats/**").hasRole("ADMIN")

                // ── Admin or Worker endpoints ─────────────────────────
                // Workers can manage products, categories, variants, orders,
                // promotions and stock if granted access. For MVP, both roles
                // share these routes; fine-grained RBAC comes in Phase 3.
                .requestMatchers("/api/v1/admin/products/**").hasAnyRole("ADMIN", "WORKER")
                .requestMatchers("/api/v1/admin/categories/**").hasAnyRole("ADMIN", "WORKER")
                .requestMatchers("/api/v1/admin/variants/**").hasAnyRole("ADMIN", "WORKER")
                .requestMatchers("/api/v1/admin/orders/**").hasAnyRole("ADMIN", "WORKER")
                .requestMatchers("/api/v1/admin/promotions/**").hasAnyRole("ADMIN", "WORKER")
                .requestMatchers("/api/v1/admin/questions/**").hasAnyRole("ADMIN", "WORKER")

                // ── Dedicated worker endpoints ────────────────────────
                .requestMatchers("/api/v1/worker/**").hasAnyRole("ADMIN", "WORKER")

                // ── Catch-all for any other /api/admin route ──────────
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                // ── Everything else requires authentication ───────────
                .anyRequest().authenticated()
            )
            // ── OAuth2 login (Google) ──────────────────────────────────────────
            // The session is still required for the OAuth2 authorization code flow
            // (Spring Security stores the state in the session between the redirect
            // and the callback). We keep STATELESS for JWT auth but allow the OAuth2
            // flow to use a session internally. The success handler immediately issues
            // a JWT and discards the session.
            .oauth2Login(oauth2 -> oauth2
                    .userInfoEndpoint(ui -> ui.userService(customOAuth2UserService))
                    .successHandler(oAuth2SuccessHandler)
            )
            .exceptionHandling(ex -> ex
                // Return 401 (not 403) when the request is unauthenticated (missing/expired token)
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getWriter(),
                            Map.of("status", 401, "error", "Unauthorized — please log in"));
                })
                // Return 403 when the user IS authenticated but lacks the required role
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getWriter(),
                            Map.of("status", 403, "error", "Forbidden — insufficient permissions"));
                })
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            // RateLimitFilter runs AFTER JwtAuthenticationFilter on purpose: once the JWT
            // is parsed, SecurityContextHolder has the authenticated userId, and the filter
            // can key the "global" bucket per-account instead of per-IP. This fixes two
            // known issues: false positives behind shared NAT, and an authenticated user
            // rotating IPs to dodge their limit. Login/register/forgot-password/payments
            // stay IP-keyed regardless (there's no authenticated identity yet at that point,
            // which is exactly what you want for anti-credential-stuffing).
            .addFilterAfter(new RateLimitFilter(
                    authProperties.rateLimit().login(),
                    authProperties.rateLimit().register(),
                    authProperties.rateLimit().forgotPassword(),
                    authProperties.rateLimit().payments(),
                    authProperties.rateLimit().global(),
                    authProperties.trustedProxyHops(),
                    bucketProxyManager.orElse(null)
            ), JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/**", config);
        source.registerCorsConfiguration("/login/**", config);
        source.registerCorsConfiguration("/oauth2/**", config);
        return source;
    }
}
