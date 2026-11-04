package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.request.CartItemRequest;
import com.tiendaropa.dto.response.CartResponse;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.CartService;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CartController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class CartControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean CartService cartService;

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

    private static final Long USER_ID = 42L;

    /** Authentication with Long principal — matches what JwtAuthenticationFilter produces. */
    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                USER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private CartResponse emptyCart() {
        return CartResponse.builder()
                .cartId(1L)
                .items(List.of())
                .totalAmount(0L)
                .currencyCode("ARS")
                .build();
    }

    // ── security ──────────────────────────────────────────────────────────────

    @Test
    void getCart_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isUnauthorized());
    }

    // ── getCart ───────────────────────────────────────────────────────────────

    @Test
    void getCart_authenticated_returnsCart() throws Exception {
        when(cartService.getCart(USER_ID)).thenReturn(emptyCart());

        mockMvc.perform(get("/api/v1/cart")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cartId").value(1))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalAmount").value(0))
                .andExpect(jsonPath("$.currencyCode").value("ARS"));
    }

    // ── addItem ───────────────────────────────────────────────────────────────

    @Test
    void addItem_validRequest_returns201() throws Exception {
        CartResponse response = CartResponse.builder()
                .cartId(1L)
                .items(List.of(CartResponse.CartItemResponse.builder()
                        .cartItemId(10L)
                        .productVariantId(5L)
                        .productName("Remera")
                        .quantity(2)
                        .unitPrice(3500L)
                        .currencyCode("ARS")
                        .build()))
                .totalAmount(7000L)
                .currencyCode("ARS")
                .build();

        when(cartService.addItem(eq(USER_ID), any(CartItemRequest.class))).thenReturn(response);

        CartItemRequest req = new CartItemRequest();
        req.setProductVariantId(5L);
        req.setQuantity(2);

        mockMvc.perform(post("/api/v1/cart/items")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(7000))
                .andExpect(jsonPath("$.items[0].productName").value("Remera"));
    }

    @Test
    void addItem_withoutAuth_returns401() throws Exception {
        CartItemRequest req = new CartItemRequest();
        req.setProductVariantId(5L);
        req.setQuantity(1);

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    // ── removeItem ────────────────────────────────────────────────────────────

    @Test
    void removeItem_authenticated_returnsUpdatedCart() throws Exception {
        when(cartService.removeItem(eq(USER_ID), eq(10L))).thenReturn(emptyCart());

        mockMvc.perform(delete("/api/v1/cart/items/10")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    // ── updateQuantity ────────────────────────────────────────────────────────

    @Test
    void updateQuantity_authenticated_returnsUpdatedCart() throws Exception {
        when(cartService.updateQuantity(eq(USER_ID), eq(10L), eq(3))).thenReturn(emptyCart());

        mockMvc.perform(patch("/api/v1/cart/items/10")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":3}"))
                .andExpect(status().isOk());
    }
}
