package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.entity.CarrierConfig;
import com.tiendaropa.enums.CarrierMode;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CarrierConfigRepository;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.carrier.CarrierAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminCarrierConfigController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class AdminCarrierConfigControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean CarrierConfigRepository carrierConfigRepository;
    @MockitoBean List<CarrierAdapter> adapters;

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

    private Authentication adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                1L, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                2L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private CarrierConfig ocaConfig() {
        return CarrierConfig.builder()
                .id(1L)
                .carrierCode("OCA")
                .carrierName("OCA e-Pak")
                .mode(CarrierMode.MANUAL)
                .enabled(true)
                .build();
    }

    // ─── GET /api/admin/carriers ──────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/admin/carriers")
    class ListCarriers {

        @Test
        @DisplayName("admin can list carriers")
        void adminCanListCarriers() throws Exception {
            when(carrierConfigRepository.findAll()).thenReturn(List.of(ocaConfig()));

            mockMvc.perform(get("/api/v1/admin/carriers")
                            .with(authentication(adminAuth())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].carrierCode").value("OCA"))
                    .andExpect(jsonPath("$[0].carrierName").value("OCA e-Pak"))
                    .andExpect(jsonPath("$[0].mode").value("MANUAL"))
                    .andExpect(jsonPath("$[0].enabled").value(true));
        }

        @Test
        @DisplayName("non-admin user gets 403")
        void nonAdminGetsForbidden() throws Exception {
            mockMvc.perform(get("/api/v1/admin/carriers")
                            .with(authentication(userAuth())))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("unauthenticated request gets 401")
        void unauthenticatedGetsUnauthorized() throws Exception {
            mockMvc.perform(get("/api/v1/admin/carriers"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("response never exposes raw credentials")
        void responseDoesNotExposeCredentials() throws Exception {
            CarrierConfig withCreds = CarrierConfig.builder()
                    .id(2L)
                    .carrierCode("ANDREANI")
                    .carrierName("Andreani")
                    .mode(CarrierMode.AUTO)
                    .enabled(true)
                    .apiUsername("secretUser")
                    .apiPassword("secretPass")
                    .apiClientNumber("12345")
                    .build();

            when(carrierConfigRepository.findAll()).thenReturn(List.of(withCreds));

            String body = mockMvc.perform(get("/api/v1/admin/carriers")
                            .with(authentication(adminAuth())))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            // Raw credential values must NOT appear in the response
            org.assertj.core.api.Assertions.assertThat(body).doesNotContain("secretUser");
            org.assertj.core.api.Assertions.assertThat(body).doesNotContain("secretPass");
            // Boolean flags should be present instead
            org.assertj.core.api.Assertions.assertThat(body).contains("hasUsername");
            org.assertj.core.api.Assertions.assertThat(body).contains("hasPassword");
        }
    }

    // ─── PUT /api/admin/carriers/{code} ───────────────────────────────────────

    @Nested
    @DisplayName("PUT /api/admin/carriers/{code}")
    class UpdateCarrier {

        @Test
        @DisplayName("admin can toggle mode to AUTO")
        void adminCanToggleMode() throws Exception {
            CarrierConfig config = ocaConfig();
            when(carrierConfigRepository.findByCarrierCode("OCA")).thenReturn(Optional.of(config));
            when(carrierConfigRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> body = Map.of("mode", "AUTO");

            mockMvc.perform(put("/api/v1/admin/carriers/OCA")
                            .with(authentication(adminAuth()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.carrierCode").value("OCA"));
        }

        @Test
        @DisplayName("admin can disable a carrier")
        void adminCanDisableCarrier() throws Exception {
            CarrierConfig config = ocaConfig();
            when(carrierConfigRepository.findByCarrierCode("OCA")).thenReturn(Optional.of(config));
            when(carrierConfigRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> body = Map.of("enabled", false);

            mockMvc.perform(put("/api/v1/admin/carriers/OCA")
                            .with(authentication(adminAuth()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("returns 404 when carrier code not found")
        void returns404WhenNotFound() throws Exception {
            when(carrierConfigRepository.findByCarrierCode("UNKNOWN"))
                    .thenReturn(Optional.empty());

            Map<String, Object> body = Map.of("enabled", false);

            mockMvc.perform(put("/api/v1/admin/carriers/UNKNOWN")
                            .with(authentication(adminAuth()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("non-admin user gets 403 on update")
        void nonAdminGetsForbiddenOnUpdate() throws Exception {
            Map<String, Object> body = Map.of("enabled", false);

            mockMvc.perform(put("/api/v1/admin/carriers/OCA")
                            .with(authentication(userAuth()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isForbidden());
        }
    }
}
