package com.tiendaropa.service;

import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.JwtTokenProvider;
import com.tiendaropa.security.SecurityEventLogger;
import com.tiendaropa.security.TokenBlacklistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock JwtTokenProvider tokenProvider;
    @Mock TokenBlacklistService blacklistService;
    @Mock SecurityEventLogger securityEvents;
    @Mock UserRepository userRepository;

    @InjectMocks TokenService tokenService;

    private User activeUser;

    @BeforeEach
    void setUp() {
        activeUser = User.builder()
                .id(1L)
                .email("ivan@test.com")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .emailVerified(true)
                .firstName("Ivan")
                .lastName("Sanchez")
                .build();
    }

    // ── buildAuthResponse ─────────────────────────────────────────────────────

    @Nested
    class BuildAuthResponse {

        @Test
        void usuarioValido_retornaResponseConTokensYDatosDeUsuario() {
            when(tokenProvider.generateAccessToken(1L, "ivan@test.com", "CUSTOMER"))
                    .thenReturn("access-token");
            when(tokenProvider.generateRefreshToken(1L, "ivan@test.com", "CUSTOMER"))
                    .thenReturn("refresh-token");
            when(tokenProvider.getExpirationMs()).thenReturn(86400000L);

            AuthResponse response = tokenService.buildAuthResponse(activeUser);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
            assertThat(response.getTokenType()).isEqualTo("Bearer");
            assertThat(response.getExpiresIn()).isEqualTo(86400L);
            assertThat(response.getUser().getEmail()).isEqualTo("ivan@test.com");
            assertThat(response.getUser().getId()).isEqualTo(1L);
        }
    }

    // ── tempTokenResponse ─────────────────────────────────────────────────────

    @Nested
    class TempTokenResponse {

        @Test
        void retornaResponseConRequiresTwoFactorYTempToken() {
            when(tokenProvider.generateTempToken(1L)).thenReturn("temp-token");

            AuthResponse response = tokenService.tempTokenResponse(1L);

            assertThat(response.isRequiresTwoFactor()).isTrue();
            assertThat(response.getTempToken()).isEqualTo("temp-token");
            assertThat(response.getAccessToken()).isNull();
        }
    }

    // ── refreshToken ──────────────────────────────────────────────────────────

    @Nested
    class RefreshToken {

        @Test
        void refreshTokenValido_retornaNewTokenPair() {
            when(tokenProvider.validateToken("valid-refresh")).thenReturn(true);
            when(tokenProvider.isRefreshToken("valid-refresh")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("valid-refresh")).thenReturn(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(activeUser));
            when(tokenProvider.generateAccessToken(any(), any(), any())).thenReturn("new-access");
            when(tokenProvider.generateRefreshToken(any(), any(), any())).thenReturn("new-refresh");
            when(tokenProvider.getExpirationMs()).thenReturn(86400000L);

            AuthResponse response = tokenService.refreshToken("valid-refresh");

            assertThat(response.getAccessToken()).isEqualTo("new-access");
            assertThat(response.getRefreshToken()).isEqualTo("new-refresh");
            verify(securityEvents).tokenRefreshed(eq(1L), any());
        }

        @Test
        void tokenInvalido_lanzaBusinessException() {
            when(tokenProvider.validateToken("bad-token")).thenReturn(false);

            assertThatThrownBy(() -> tokenService.refreshToken("bad-token"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("inválido");
        }

        @Test
        void tokenNoEsRefresh_lanzaBusinessException() {
            when(tokenProvider.validateToken("access-token")).thenReturn(true);
            when(tokenProvider.isRefreshToken("access-token")).thenReturn(false);

            assertThatThrownBy(() -> tokenService.refreshToken("access-token"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("inválido");
        }

        @Test
        void usuarioDeshabilitado_lanzaBusinessException() {
            activeUser.setEnabled(false);
            when(tokenProvider.validateToken("valid-refresh")).thenReturn(true);
            when(tokenProvider.isRefreshToken("valid-refresh")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("valid-refresh")).thenReturn(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(activeUser));

            assertThatThrownBy(() -> tokenService.refreshToken("valid-refresh"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("deshabilitada");
        }
    }

    // ── logout ────────────────────────────────────────────────────────────────

    @Nested
    class Logout {

        @Test
        void tokenValido_revocaJtiYLoguea() {
            Date expiration = new Date(System.currentTimeMillis() + 3_600_000L);
            when(tokenProvider.validateToken("access-token")).thenReturn(true);
            when(tokenProvider.getJtiFromToken("access-token")).thenReturn("jti-uuid");
            when(tokenProvider.getUserIdFromToken("access-token")).thenReturn(1L);
            when(tokenProvider.getExpirationFromToken("access-token")).thenReturn(expiration);

            tokenService.logout("access-token");

            verify(blacklistService).revoke("jti-uuid", expiration);
            verify(securityEvents).logout(eq(1L), any());
            verify(securityEvents).tokenRevoked(eq(1L), eq("jti-uuid"));
        }

        @Test
        void tokenInvalido_noHaceNada() {
            when(tokenProvider.validateToken("bad-token")).thenReturn(false);

            tokenService.logout("bad-token");

            verify(blacklistService, never()).revoke(any(), any());
            verify(securityEvents, never()).logout(any(), any());
        }

        @Test
        void tokenSinJti_noRevocaNada() {
            when(tokenProvider.validateToken("no-jti-token")).thenReturn(true);
            when(tokenProvider.getJtiFromToken("no-jti-token")).thenReturn(null);

            tokenService.logout("no-jti-token");

            verify(blacklistService, never()).revoke(any(), any());
        }
    }
}
