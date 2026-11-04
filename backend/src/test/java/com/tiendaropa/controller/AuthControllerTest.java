package com.tiendaropa.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.config.SecurityConfig;
import com.tiendaropa.config.TestConfig;
import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.dto.response.UserResponse;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.security.CustomOAuth2UserService;
import com.tiendaropa.security.JwtAuthenticationFilter;
import com.tiendaropa.security.OAuth2AuthenticationSuccessHandler;
import com.tiendaropa.service.AuthService;
import com.tiendaropa.service.TokenService;
import com.tiendaropa.service.TwoFactorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, TestConfig.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean AuthService authService;
    @MockitoBean TokenService tokenService;
    @MockitoBean TwoFactorService twoFactorService;

    // SecurityConfig constructor dependencies
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

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_validRequest_returns201() throws Exception {
        AuthResponse response = AuthResponse.builder()
                .accessToken("token")
                .refreshToken("refresh")
                .tokenType("Bearer")
                .expiresIn(86400000L)
                .user(UserResponse.builder().id(1L).email("test@test.com").build())
                .build();

        when(authService.register(any())).thenReturn(response);

        RegisterRequest req = new RegisterRequest();
        req.setEmail("test@test.com");
        req.setPassword("Password@123");
        req.setFirstName("Juan");
        req.setLastName("García");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"));
    }

    @Test
    void register_blankEmail_returns400() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("");
        req.setPassword("password123");
        req.setFirstName("Juan");
        req.setLastName("García");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.email").exists());
    }

    @Test
    void register_passwordTooShort_returns400() throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("test@test.com");
        req.setPassword("short");
        req.setFirstName("Juan");
        req.setLastName("García");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.password").exists());
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        when(authService.register(any()))
                .thenThrow(new BusinessException("Email ya registrado", HttpStatus.CONFLICT));

        RegisterRequest req = new RegisterRequest();
        req.setEmail("existing@test.com");
        req.setPassword("Password@123");
        req.setFirstName("Juan");
        req.setLastName("García");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict());
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_validCredentials_returnsToken() throws Exception {
        AuthResponse response = AuthResponse.builder()
                .accessToken("jwt-token")
                .refreshToken("refresh-token")
                .tokenType("Bearer")
                .expiresIn(86400000L)
                .build();

        when(authService.login(any())).thenReturn(response);

        LoginRequest req = new LoginRequest();
        req.setEmail("test@test.com");
        req.setPassword("password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("jwt-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"));
    }

    @Test
    void login_invalidCredentials_returns401() throws Exception {
        when(authService.login(any()))
                .thenThrow(new BusinessException("Credenciales inválidas", HttpStatus.UNAUTHORIZED));

        LoginRequest req = new LoginRequest();
        req.setEmail("test@test.com");
        req.setPassword("wrongpass");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_invalidEmailFormat_returns400() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("not-an-email");
        req.setPassword("password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // ── forgot-password ───────────────────────────────────────────────────────

    @Test
    void forgotPassword_alwaysReturns200() throws Exception {
        // Service should not throw even when email doesn't exist (user enumeration prevention)
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unknown@test.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }
}
