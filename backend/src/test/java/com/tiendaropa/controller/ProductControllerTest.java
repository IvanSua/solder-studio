package com.tiendaropa.controller;

import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.ProductService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProductController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class ProductControllerTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean ProductService productService;
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

    private ProductResponse sampleProduct() {
        return ProductResponse.builder()
                .id(1L)
                .name("Remera Básica")
                .slug("remera-basica")
                .active(true)
                .variants(List.of())
                .images(List.of())
                .build();
    }

    // ── listProducts ──────────────────────────────────────────────────────────

    @Test
    void listProducts_noAuth_returns200() throws Exception {
        when(productService.listProducts(any())).thenReturn(new PageImpl<>(List.of(sampleProduct())));

        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].name").value("Remera Básica"));
    }

    @Test
    void listProducts_withCategoryFilter_returns200() throws Exception {
        when(productService.listByCategory(eq(5L), any())).thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/v1/products").param("categoryId", "5"))
                .andExpect(status().isOk());
    }

    // ── getProduct ────────────────────────────────────────────────────────────

    @Test
    void getProduct_byId_returns200() throws Exception {
        when(productService.getProduct(1L)).thenReturn(sampleProduct());

        mockMvc.perform(get("/api/v1/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Remera Básica"))
                .andExpect(jsonPath("$.slug").value("remera-basica"));
    }

    @Test
    void getProduct_notFound_returns404() throws Exception {
        when(productService.getProduct(anyLong()))
                .thenThrow(new ResourceNotFoundException("Product not found"));

        mockMvc.perform(get("/api/v1/products/999"))
                .andExpect(status().isNotFound());
    }

    // ── getProductBySlug ──────────────────────────────────────────────────────

    @Test
    void getProductBySlug_returns200() throws Exception {
        when(productService.getProductBySlug("remera-basica")).thenReturn(sampleProduct());

        mockMvc.perform(get("/api/v1/products/slug/remera-basica"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("remera-basica"));
    }

    @Test
    void getProductBySlug_notFound_returns404() throws Exception {
        when(productService.getProductBySlug(anyString()))
                .thenThrow(new ResourceNotFoundException("Product not found"));

        mockMvc.perform(get("/api/v1/products/slug/no-existe"))
                .andExpect(status().isNotFound());
    }

    // ── listByCategory ────────────────────────────────────────────────────────

    @Test
    void listByCategory_returns200() throws Exception {
        when(productService.listByCategory(eq(3L), any()))
                .thenReturn(new PageImpl<>(List.of(sampleProduct())));

        mockMvc.perform(get("/api/v1/products/category/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(1));
    }

    // ── search ────────────────────────────────────────────────────────────────

    @Test
    void search_withQuery_returns200() throws Exception {
        when(productService.search(eq("remera"), any()))
                .thenReturn(new PageImpl<>(List.of(sampleProduct())));

        mockMvc.perform(get("/api/v1/products/search").param("q", "remera"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void search_missingQuery_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/products/search"))
                .andExpect(status().isBadRequest());
    }

    // ── autocomplete ──────────────────────────────────────────────────────────

    @Test
    void autocomplete_withQuery_returns200() throws Exception {
        when(productService.autocomplete("rem")).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/products/autocomplete").param("q", "rem"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void autocomplete_missingQuery_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/products/autocomplete"))
                .andExpect(status().isBadRequest());
    }

    // ── filterOptions ─────────────────────────────────────────────────────────

    @Test
    void filterOptions_returns200() throws Exception {
        when(productService.getFilterOptions(any())).thenReturn(null);

        mockMvc.perform(get("/api/v1/products/filter-options"))
                .andExpect(status().isOk());
    }
}
