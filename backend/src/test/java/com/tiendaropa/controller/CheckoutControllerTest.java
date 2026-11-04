package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.request.CheckoutRequest;
import com.tiendaropa.dto.response.CheckoutResponse;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.CheckoutService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CheckoutController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class CheckoutControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean CheckoutService checkoutService;
    @MockitoBean JwtAuthenticationFilter jwtFilter;
    @MockitoBean CustomOAuth2UserService oAuth2UserService;
    @MockitoBean OAuth2AuthenticationSuccessHandler oAuth2SuccessHandler;

    @BeforeEach
    void letJwtFilterPassThrough() throws Exception {
        doAnswer(inv -> {
            ((jakarta.servlet.FilterChain) inv.getArgument(2))
                    .doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtFilter).doFilter(any(), any(), any());
    }

    private static final Long USER_ID = 10L;

    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                USER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private CheckoutRequest validRequest() {
        CheckoutRequest req = new CheckoutRequest();
        req.setIdempotencyKey(java.util.UUID.randomUUID().toString());
        req.setCartId(1L);
        req.setShippingAddressId(2L);
        req.setPaymentMethod("MERCADOPAGO");
        return req;
    }

    private CheckoutResponse sampleResponse() {
        return CheckoutResponse.builder()
                .orderId(100L)
                .reservationExpiresAt(Instant.now().plusSeconds(900))
                .paymentSession(CheckoutResponse.PaymentSession.builder()
                        .provider("MERCADOPAGO")
                        .checkoutUrl("https://mercadopago.com/checkout/1")
                        .build())
                .amounts(CheckoutResponse.OrderAmounts.builder()
                        .subtotal(5000L)
                        .total(5500L)
                        .currency("ARS")
                        .build())
                .build();
    }

    // ── security ──────────────────────────────────────────────────────────────

    @Test
    void checkout_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loyaltyPreview_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/checkout/loyalty-preview")
                        .param("subtotal", "5000"))
                .andExpect(status().isUnauthorized());
    }

    // ── checkout ──────────────────────────────────────────────────────────────

    @Test
    void checkout_withValidRequest_returns201() throws Exception {
        when(checkoutService.checkout(anyLong(), any(CheckoutRequest.class)))
                .thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/checkout")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderId").value(100))
                .andExpect(jsonPath("$.paymentSession.provider").value("MERCADOPAGO"));
    }

    @Test
    void checkout_missingCartId_returns400() throws Exception {
        CheckoutRequest req = new CheckoutRequest();
        req.setShippingAddressId(2L);
        req.setPaymentMethod("MERCADOPAGO");
        // cartId is null — @NotNull should reject it

        mockMvc.perform(post("/api/v1/checkout")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_missingPaymentMethod_returns400() throws Exception {
        CheckoutRequest req = new CheckoutRequest();
        req.setCartId(1L);
        req.setShippingAddressId(2L);
        // paymentMethod is null — @NotBlank should reject it

        mockMvc.perform(post("/api/v1/checkout")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_emptyBody_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ── loyaltyPreview ────────────────────────────────────────────────────────

    @Test
    void loyaltyPreview_withAuth_returns200() throws Exception {
        when(checkoutService.previewLoyaltyDiscount(anyLong(), anyLong(), anyInt()))
                .thenReturn(null);

        mockMvc.perform(get("/api/v1/checkout/loyalty-preview")
                        .with(authentication(userAuth()))
                        .param("subtotal", "5000"))
                .andExpect(status().isOk());
    }

    @Test
    void loyaltyPreview_negativeSubtotal_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/checkout/loyalty-preview")
                        .with(authentication(userAuth()))
                        .param("subtotal", "-1"))
                .andExpect(status().isBadRequest());
    }
}
