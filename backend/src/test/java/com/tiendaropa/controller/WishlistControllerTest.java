package com.tiendaropa.controller;

import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.WishlistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(WishlistController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class WishlistControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean WishlistService wishlistService;
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

    private static final Long USER_ID = 5L;

    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                USER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private ProductResponse sampleProduct() {
        return ProductResponse.builder()
                .id(1L)
                .name("Remera Deseada")
                .slug("remera-deseada")
                .active(true)
                .variants(List.of())
                .images(List.of())
                .build();
    }

    // ── security ──────────────────────────────────────────────────────────────

    @Test
    void getWishlist_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/wishlist"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void toggle_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/wishlist/1/toggle"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getWishlistedIds_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/wishlist/ids"))
                .andExpect(status().isUnauthorized());
    }

    // ── getWishlist ───────────────────────────────────────────────────────────

    @Test
    void getWishlist_withAuth_returnsProductList() throws Exception {
        when(wishlistService.getWishlist(USER_ID)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/wishlist")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].name").value("Remera Deseada"));
    }

    @Test
    void getWishlist_emptyList_returns200() throws Exception {
        when(wishlistService.getWishlist(USER_ID)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/wishlist")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    // ── toggle ────────────────────────────────────────────────────────────────

    @Test
    void toggle_addToWishlist_returnsWishlistedTrue() throws Exception {
        when(wishlistService.toggle(USER_ID, 1L)).thenReturn(true);

        mockMvc.perform(post("/api/v1/wishlist/1/toggle")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishlisted").value(true));
    }

    @Test
    void toggle_removeFromWishlist_returnsWishlistedFalse() throws Exception {
        when(wishlistService.toggle(USER_ID, 1L)).thenReturn(false);

        mockMvc.perform(post("/api/v1/wishlist/1/toggle")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishlisted").value(false));
    }

    // ── getWishlistedIds ──────────────────────────────────────────────────────

    @Test
    void getWishlistedIds_withAuth_returnsSetOfIds() throws Exception {
        when(wishlistService.getWishlistedProductIds(USER_ID)).thenReturn(Set.of(1L, 3L, 7L));

        mockMvc.perform(get("/api/v1/wishlist/ids")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getWishlistedIds_emptyWishlist_returnsEmptySet() throws Exception {
        when(wishlistService.getWishlistedProductIds(USER_ID)).thenReturn(Set.of());

        mockMvc.perform(get("/api/v1/wishlist/ids")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
