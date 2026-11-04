package com.tiendaropa.service;

import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.JwtTokenProvider;
import com.tiendaropa.security.SecurityEventLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwoFactorServiceTest {

    @Mock UserRepository userRepository;
    @Mock TotpService totpService;
    @Mock JwtTokenProvider tokenProvider;
    @Mock TokenService tokenService;
    @Mock SecurityEventLogger securityEvents;

    @InjectMocks TwoFactorService twoFactorService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("ivan@test.com")
                .passwordHash("hashed")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .twoFactorEnabled(false)
                .twoFactorSecret(null)
                .build();
    }

    // ── setup2FA ──────────────────────────────────────────────────────────────

    @Nested
    class Setup2FA {

        @Test
        void usuarioExistente_guardaSecretoYRetornaUriYSecret() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.generateSecret()).thenReturn("JBSWY3DPEHPK3PXP");
            when(totpService.buildOtpAuthUri("ivan@test.com", "JBSWY3DPEHPK3PXP"))
                    .thenReturn("otpauth://totp/SolderStudio:ivan@test.com?secret=JBSWY3DPEHPK3PXP");

            Map<String, String> result = twoFactorService.setup2FA(1L);

            assertThat(result).containsKey("secret").containsKey("otpauthUri");
            assertThat(result.get("secret")).isEqualTo("JBSWY3DPEHPK3PXP");
            assertThat(user.getTwoFactorSecret()).isEqualTo("JBSWY3DPEHPK3PXP");
            verify(userRepository).save(user);
        }

        @Test
        void usuarioNoExiste_lanzaBusinessException() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> twoFactorService.setup2FA(99L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("not found");
        }
    }

    // ── enable2FA ─────────────────────────────────────────────────────────────

    @Nested
    class Enable2FA {

        @Test
        void codigoCorrecto_activa2FA() {
            user.setTwoFactorSecret("SECRET123");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "123456")).thenReturn(true);

            twoFactorService.enable2FA(1L, "123456");

            assertThat(user.isTwoFactorEnabled()).isTrue();
            verify(userRepository).save(user);
            verify(securityEvents).twoFactorEnabled(1L);
        }

        @Test
        void sinSecretoConfigurado_lanzaBusinessException() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            // user.twoFactorSecret == null

            assertThatThrownBy(() -> twoFactorService.enable2FA(1L, "123456"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("setup");
        }

        @Test
        void codigoIncorrecto_lanzaBusinessException() {
            user.setTwoFactorSecret("SECRET123");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "000000")).thenReturn(false);

            assertThatThrownBy(() -> twoFactorService.enable2FA(1L, "000000"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Código");
        }
    }

    // ── disable2FA ────────────────────────────────────────────────────────────

    @Nested
    class Disable2FA {

        @Test
        void codigoCorrecto_desactiva2FAYBorraSecreto() {
            user.setTwoFactorEnabled(true);
            user.setTwoFactorSecret("SECRET123");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "123456")).thenReturn(true);

            twoFactorService.disable2FA(1L, "123456");

            assertThat(user.isTwoFactorEnabled()).isFalse();
            assertThat(user.getTwoFactorSecret()).isNull();
            verify(userRepository).save(user);
            verify(securityEvents).twoFactorDisabled(1L);
        }

        @Test
        void yaDesactivado_retornaSinHacerNada() {
            user.setTwoFactorEnabled(false);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            twoFactorService.disable2FA(1L, "123456");

            verify(totpService, never()).verifyCode(any(), any());
            verify(userRepository, never()).save(any());
        }

        @Test
        void codigoIncorrecto_lanzaBusinessException() {
            user.setTwoFactorEnabled(true);
            user.setTwoFactorSecret("SECRET123");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "000000")).thenReturn(false);

            assertThatThrownBy(() -> twoFactorService.disable2FA(1L, "000000"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Código");
        }
    }

    // ── verifyTwoFactor ───────────────────────────────────────────────────────

    @Nested
    class VerifyTwoFactor {

        private static final AuthResponse FULL_RESPONSE = AuthResponse.builder()
                .accessToken("access-token").refreshToken("refresh-token").build();

        @Test
        void tokenYCodigoValidos_retornaTokensCompletos() {
            user.setTwoFactorEnabled(true);
            user.setTwoFactorSecret("SECRET123");

            when(tokenProvider.validateToken("temp-token")).thenReturn(true);
            when(tokenProvider.isTempToken("temp-token")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("temp-token")).thenReturn(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "123456")).thenReturn(true);
            when(tokenService.buildAuthResponse(user)).thenReturn(FULL_RESPONSE);

            AuthResponse response = twoFactorService.verifyTwoFactor("temp-token", "123456");

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            verify(securityEvents).twoFactorSuccess(eq(1L), any());
            verify(securityEvents).loginSuccess(eq(1L), eq("ivan@test.com"), any());
        }

        @Test
        void tokenTempInvalido_lanzaBusinessException() {
            when(tokenProvider.validateToken("bad-token")).thenReturn(false);

            assertThatThrownBy(() -> twoFactorService.verifyTwoFactor("bad-token", "123456"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Token temporal");
        }

        @Test
        void tokenNoEsTemp_lanzaBusinessException() {
            when(tokenProvider.validateToken("access-token")).thenReturn(true);
            when(tokenProvider.isTempToken("access-token")).thenReturn(false);

            assertThatThrownBy(() -> twoFactorService.verifyTwoFactor("access-token", "123456"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Token temporal");
        }

        @Test
        void codigoTotpIncorrecto_lanzaBusinessExceptionYLogEvent() {
            user.setTwoFactorEnabled(true);
            user.setTwoFactorSecret("SECRET123");

            when(tokenProvider.validateToken("temp-token")).thenReturn(true);
            when(tokenProvider.isTempToken("temp-token")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("temp-token")).thenReturn(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(totpService.verifyCode("SECRET123", "000000")).thenReturn(false);

            assertThatThrownBy(() -> twoFactorService.verifyTwoFactor("temp-token", "000000"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("2FA");

            verify(securityEvents).twoFactorFailed(eq(1L), any());
        }
    }
}
