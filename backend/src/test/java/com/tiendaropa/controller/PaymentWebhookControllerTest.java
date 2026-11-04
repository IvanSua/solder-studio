package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.PaymentWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentWebhookController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class PaymentWebhookControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean PaymentWebhookService paymentWebhookService;
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

    private static final String WEBHOOK_URL = "/api/v1/payments/webhook";

    private String minimalPayload() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "type", "payment",
                "data", Map.of("id", "12345")
        ));
    }

    // ── handleWebhook ─────────────────────────────────────────────────────────

    @Test
    void handleWebhook_noSignature_returns200() throws Exception {
        // Endpoint is public — no auth required, always returns 200 OK
        mockMvc.perform(post(WEBHOOK_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(minimalPayload()))
                .andExpect(status().isOk());
    }

    @Test
    void handleWebhook_withMercadoPagoHeaders_returns200() throws Exception {
        mockMvc.perform(post(WEBHOOK_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("x-signature", "ts=1700000000,v1=abc123def456")
                        .header("x-request-id", "req-uuid-1234")
                        .content(minimalPayload()))
                .andExpect(status().isOk());
    }

    @Test
    void handleWebhook_emptyBody_returns200() throws Exception {
        // Service is responsible for validation — controller always returns 200
        // to avoid MP retry storms on validation errors.
        mockMvc.perform(post(WEBHOOK_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    @Test
    void handleWebhook_callsServiceWithPayload() throws Exception {
        mockMvc.perform(post(WEBHOOK_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("x-signature", "ts=1700000000,v1=sig")
                        .header("x-request-id", "req-1")
                        .content(minimalPayload()))
                .andExpect(status().isOk());

        verify(paymentWebhookService).processWebhook(
                any(Map.class),
                eq("ts=1700000000,v1=sig"),
                eq("req-1"));
    }
}
