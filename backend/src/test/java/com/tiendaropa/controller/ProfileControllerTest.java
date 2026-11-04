package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.response.UserResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.PointsService;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProfileController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class ProfileControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean UserRepository userRepository;
    @MockitoBean PasswordEncoder passwordEncoder;
    @MockitoBean PointsService pointsService;
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

    private static final Long USER_ID = 7L;

    private Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                USER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private User mockUser() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(USER_ID);
        when(user.getEmail()).thenReturn("ivan@test.com");
        when(user.getFirstName()).thenReturn("Ivan");
        when(user.getLastName()).thenReturn("Sanchez");
        when(user.getRole()).thenReturn(com.tiendaropa.enums.UserRole.CUSTOMER);
        when(user.isEnabled()).thenReturn(true);
        when(user.isEmailVerified()).thenReturn(true);
        when(user.isTwoFactorEnabled()).thenReturn(false);
        return user;
    }

    @BeforeEach
    void setUp() {
        User user = mockUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
    }

    // ── security ──────────────────────────────────────────────────────────────

    @Test
    void getProfile_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/profile"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updateProfile_withoutAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/v1/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Ivan\",\"lastName\":\"S\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePassword_withoutAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/v1/profile/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old\",\"newPassword\":\"new123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getLoyalty_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/profile/loyalty"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getPointsHistory_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/profile/points-history"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void saveSizes_withoutAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/v1/profile/sizes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sizes\":{}}"))
                .andExpect(status().isUnauthorized());
    }

    // ── getProfile ────────────────────────────────────────────────────────────

    @Test
    void getProfile_withAuth_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/profile")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ivan@test.com"))
                .andExpect(jsonPath("$.firstName").value("Ivan"));
    }

    // ── changePassword ────────────────────────────────────────────────────────

    @Test
    void changePassword_withValidRequest_returns204() throws Exception {
        when(passwordEncoder.matches(any(), any())).thenReturn(true);
        when(passwordEncoder.encode(any())).thenReturn("$2a$12$encoded");

        var req = new com.tiendaropa.dto.request.ChangePasswordRequest();
        req.setCurrentPassword("oldPass1");
        req.setNewPassword("newPass123");
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(put("/api/v1/profile/password")
                        .with(authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent());
    }

    // ── getLoyalty ────────────────────────────────────────────────────────────

    @Test
    void getLoyalty_withAuth_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/profile/loyalty")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk());
    }

    // ── getPointsHistory ──────────────────────────────────────────────────────

    @Test
    void getPointsHistory_withAuth_returns200() throws Exception {
        when(pointsService.getHistory(anyLong(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        mockMvc.perform(get("/api/v1/profile/points-history")
                        .with(authentication(userAuth())))
                .andExpect(status().isOk());
    }
}
