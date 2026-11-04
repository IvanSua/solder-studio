package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.InvoiceService;
import com.tiendaropa.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class OrderControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean OrderService orderService;
    @MockitoBean InvoiceService invoiceService;

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

    private static final Long USER_ID = 99L;

    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                USER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private OrderResponse sampleOrder(Long id) {
        return OrderResponse.builder()
                .orderId(id)
                .status("CONFIRMED")
                .customerEmail("user@test.com")
                .customerName("Juan García")
                .items(List.of())
                .amounts(OrderResponse.OrderAmounts.builder()
                        .subtotal(10000L).discount(0L).tax(0L).shipping(500L).total(10500L)
                        .currency("ARS").build())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    // ── security ──────────────────────────────────────────────────────────────

    @Test
    void listOrders_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getOrder_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/orders/1"))
                .andExpect(status().isUnauthorized());
    }

    // ── list ──────────────────────────────────────────────────────────────────

    @Test
    void listOrders_authenticated_returnsPage() throws Exception {
        PageImpl<OrderResponse> page = new PageImpl<>(List.of(sampleOrder(1L), sampleOrder(2L)));
        when(orderService.getUserOrders(eq(USER_ID), any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/v1/orders")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].orderId").value(1))
                .andExpect(jsonPath("$.content[0].status").value("CONFIRMED"));
    }

    @Test
    void listOrders_supportsPageableParams() throws Exception {
        PageImpl<OrderResponse> page = new PageImpl<>(List.of(sampleOrder(5L)));
        when(orderService.getUserOrders(eq(USER_ID), any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/v1/orders?page=0&size=5&sort=createdAt,desc")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].orderId").value(5));
    }

    // ── get ───────────────────────────────────────────────────────────────────

    @Test
    void getOrder_existingId_returnsOrder() throws Exception {
        when(orderService.getOrder(eq(USER_ID), eq(10L))).thenReturn(sampleOrder(10L));

        mockMvc.perform(get("/api/v1/orders/10")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(10))
                .andExpect(jsonPath("$.amounts.total").value(10500))
                .andExpect(jsonPath("$.amounts.currency").value("ARS"));
    }

    @Test
    void getOrder_notFound_returns404() throws Exception {
        when(orderService.getOrder(eq(USER_ID), eq(999L)))
                .thenThrow(new ResourceNotFoundException("Order not found"));

        mockMvc.perform(get("/api/v1/orders/999")
                        .with(authentication(userAuth())))
                .andExpect(status().isNotFound());
    }

    // ── cancel ────────────────────────────────────────────────────────────────

    @Test
    void cancelOrder_authenticated_returnsCancelledOrder() throws Exception {
        OrderResponse cancelled = OrderResponse.builder()
                .orderId(10L).status("CANCELLED")
                .createdAt(Instant.now()).updatedAt(Instant.now())
                .amounts(OrderResponse.OrderAmounts.builder()
                        .subtotal(0L).discount(0L).tax(0L).shipping(0L).total(0L)
                        .currency("ARS").build())
                .build();

        when(orderService.cancelOrder(eq(USER_ID), eq(10L))).thenReturn(cancelled);

        mockMvc.perform(post("/api/v1/orders/10/cancel")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    // ── invoice ───────────────────────────────────────────────────────────────

    @Test
    void invoice_authenticated_returnsPdf() throws Exception {
        byte[] fakePdf = new byte[]{0x25, 0x50, 0x44, 0x46}; // %PDF magic bytes
        when(invoiceService.generate(eq(USER_ID), eq(10L))).thenReturn(fakePdf);

        mockMvc.perform(get("/api/v1/orders/10/invoice")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"comprobante-pedido-10.pdf\""));
    }
}
