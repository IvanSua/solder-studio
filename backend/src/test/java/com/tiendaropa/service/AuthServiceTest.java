package com.tiendaropa.service;

import com.tiendaropa.config.properties.AuthProperties;
import com.tiendaropa.dto.request.ForgotPasswordRequest;
import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.request.ResetPasswordRequest;
import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.entity.PasswordResetToken;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.NewsletterRepository;
import com.tiendaropa.repository.PasswordResetTokenRepository;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.SecurityEventLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    @Mock AuthProperties authProperties;
    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock TokenService tokenService;
    @Mock SecurityEventLogger securityEvents;
    @Mock PasswordResetTokenRepository resetTokenRepository;
    @Mock EmailService emailService;
    @Mock PointsService pointsService;
    @Mock NewsletterRepository newsletterRepository;

    @InjectMocks AuthService authService;

    private static final AuthResponse DUMMY_RESPONSE = AuthResponse.builder()
            .accessToken("access-token").refreshToken("refresh-token").build();

    private User activeUser;

    @BeforeEach
    void setUp() {
        when(authProperties.maxFailedAttempts()).thenReturn(5);
        when(authProperties.lockoutMinutes()).thenReturn(15);
        when(authProperties.tokenExpiryMinutes()).thenReturn(30);
        when(authProperties.verificationTokenHours()).thenReturn(24);

        activeUser = User.builder()
                .id(1L)
                .email("ivan@test.com")
                .passwordHash("hashed")
                .firstName("Ivan")
                .lastName("Sanchez")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .emailVerified(false)
                .twoFactorEnabled(false)
                .build();
    }

    // ── register ─────────────────────────────────────────────────────────────

    @Nested
    class Register {

        private RegisterRequest validRequest() {
            RegisterRequest req = new RegisterRequest();
            req.setEmail("nuevo@test.com");
            req.setPassword("password123");
            req.setFirstName("Nuevo");
            req.setLastName("Usuario");
            return req;
        }

        @Test
        void emailNoRegistrado_creaUsuarioYRetornaToken() {
            RegisterRequest req = validRequest();
            User saved = User.builder()
                    .id(2L).email(req.getEmail())
                    .firstName(req.getFirstName()).lastName(req.getLastName())
                    .passwordHash("hashed").role(UserRole.CUSTOMER)
                    .enabled(true).emailVerified(false)
                    .referralCode("NUE123456")
                    .build();

            when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);
            when(passwordEncoder.encode(req.getPassword())).thenReturn("hashed");
            when(userRepository.findByReferralCode(any())).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenReturn(saved);
            when(tokenService.buildAuthResponse(any(User.class))).thenReturn(DUMMY_RESPONSE);

            AuthResponse response = authService.register(req);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            verify(emailService).sendWelcomeEmail(any(), any(), any());
            verify(emailService).sendVerificationEmail(any(), any(), any());
        }

        @Test
        void emailYaRegistrado_lanzaBusinessException() {
            RegisterRequest req = validRequest();
            when(userRepository.existsByEmail(req.getEmail())).thenReturn(true);

            assertThatThrownBy(() -> authService.register(req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Email already registered");
        }

        @Test
        void conCodigoReferidoValido_otorgaPuntos() {
            RegisterRequest req = validRequest();
            req.setReferralCode("REF123456");

            User referrer = User.builder().id(99L).email("referrer@test.com")
                    .role(UserRole.CUSTOMER).enabled(true).build();
            User saved = User.builder().id(2L).email(req.getEmail())
                    .firstName(req.getFirstName()).lastName(req.getLastName())
                    .passwordHash("hashed").role(UserRole.CUSTOMER)
                    .enabled(true).referralCode("NUE123456").build();

            when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);
            when(passwordEncoder.encode(any())).thenReturn("hashed");
            when(userRepository.findByReferralCode("REF123456")).thenReturn(Optional.of(referrer));
            when(userRepository.save(any(User.class))).thenReturn(saved);
            when(tokenService.buildAuthResponse(any())).thenReturn(DUMMY_RESPONSE);

            authService.register(req);

            verify(pointsService).awardPoints(eq(2L), eq(50), eq("REFERRED_SIGNUP"), eq(99L));
            verify(pointsService).awardPoints(eq(99L), eq(200), eq("REFERRAL_BONUS"), eq(2L));
        }

        @Test
        void conNewsletterOptIn_subscribEAlNewsletter() {
            RegisterRequest req = validRequest();
            req.setNewsletterOptIn(true);

            User saved = User.builder().id(2L).email(req.getEmail())
                    .firstName(req.getFirstName()).lastName(req.getLastName())
                    .passwordHash("hashed").role(UserRole.CUSTOMER)
                    .enabled(true).referralCode("NUE123456").build();

            when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);
            when(passwordEncoder.encode(any())).thenReturn("hashed");
            when(userRepository.findByReferralCode(any())).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenReturn(saved);
            when(newsletterRepository.existsByEmail(req.getEmail())).thenReturn(false);
            when(tokenService.buildAuthResponse(any())).thenReturn(DUMMY_RESPONSE);

            authService.register(req);

            verify(newsletterRepository).save(any());
        }
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Nested
    class Login {

        private LoginRequest req(String email, String password) {
            LoginRequest r = new LoginRequest();
            r.setEmail(email);
            r.setPassword(password);
            return r;
        }

        @Test
        void credencialesValidas_retornaTokens() {
            when(userRepository.findByEmail("ivan@test.com")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("pass", "hashed")).thenReturn(true);
            when(tokenService.buildAuthResponse(activeUser)).thenReturn(DUMMY_RESPONSE);

            AuthResponse response = authService.login(req("ivan@test.com", "pass"));

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.isRequiresTwoFactor()).isFalse();
        }

        @Test
        void emailNoExiste_lanzaBusinessException() {
            when(userRepository.findByEmail("noexiste@test.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(req("noexiste@test.com", "pass")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Invalid credentials");
        }

        @Test
        void passwordIncorrecto_lanzaBusinessException() {
            when(userRepository.findByEmail("ivan@test.com")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(req("ivan@test.com", "wrong")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Invalid credentials");
        }

        @Test
        void cuentaDeshabilitada_lanzaBusinessException() {
            activeUser.setEnabled(false);
            when(userRepository.findByEmail("ivan@test.com")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("pass", "hashed")).thenReturn(true);

            assertThatThrownBy(() -> authService.login(req("ivan@test.com", "pass")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("disabled");
        }

        @Test
        void usuario2FAActivo_retornaRequiresTwoFactorConTempToken() {
            activeUser.setTwoFactorEnabled(true);
            AuthResponse twoFaResponse = AuthResponse.builder()
                    .requiresTwoFactor(true).tempToken("temp-token").build();

            when(userRepository.findByEmail("ivan@test.com")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("pass", "hashed")).thenReturn(true);
            when(tokenService.tempTokenResponse(1L)).thenReturn(twoFaResponse);

            AuthResponse response = authService.login(req("ivan@test.com", "pass"));

            assertThat(response.isRequiresTwoFactor()).isTrue();
            assertThat(response.getTempToken()).isEqualTo("temp-token");
            assertThat(response.getAccessToken()).isNull();
        }
    }

    // ── verifyEmail ───────────────────────────────────────────────────────────

    @Nested
    class VerifyEmail {

        @Test
        void tokenValido_marcaEmailComoVerificado() {
            activeUser.setEmailVerificationToken("valid-token");
            activeUser.setEmailVerificationExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));

            when(userRepository.findByEmailVerificationToken("valid-token")).thenReturn(Optional.of(activeUser));

            authService.verifyEmail("valid-token");

            assertThat(activeUser.isEmailVerified()).isTrue();
            assertThat(activeUser.getEmailVerificationToken()).isNull();
            verify(userRepository).save(activeUser);
        }

        @Test
        void tokenInvalido_lanzaBusinessException() {
            when(userRepository.findByEmailVerificationToken("bad-token")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.verifyEmail("bad-token"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void tokenExpirado_lanzaBusinessException() {
            activeUser.setEmailVerificationToken("expired");
            activeUser.setEmailVerificationExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));

            when(userRepository.findByEmailVerificationToken("expired")).thenReturn(Optional.of(activeUser));

            assertThatThrownBy(() -> authService.verifyEmail("expired"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void yaVerificado_retornaSinErrorIdempotente() {
            activeUser.setEmailVerified(true);
            activeUser.setEmailVerificationToken("token");

            when(userRepository.findByEmailVerificationToken("token")).thenReturn(Optional.of(activeUser));

            assertThatNoException().isThrownBy(() -> authService.verifyEmail("token"));
            verify(userRepository, never()).save(any());
        }
    }

    // ── resetPassword ─────────────────────────────────────────────────────────

    @Nested
    class ResetPassword {

        @Test
        void tokenValidoNoUsado_actualizaPassword() {
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token("valid-token")
                    .user(activeUser)
                    .expiresAt(Instant.now().plus(30, ChronoUnit.MINUTES))
                    .used(false)
                    .build();

            ResetPasswordRequest req = new ResetPasswordRequest();
            req.setToken("valid-token");
            req.setNewPassword("newpassword123");

            when(resetTokenRepository.findByToken("valid-token")).thenReturn(Optional.of(resetToken));
            when(passwordEncoder.encode("newpassword123")).thenReturn("new-hashed");

            authService.resetPassword(req);

            assertThat(activeUser.getPasswordHash()).isEqualTo("new-hashed");
            assertThat(resetToken.isUsed()).isTrue();
        }

        @Test
        void tokenYaUsado_lanzaBusinessException() {
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token("used-token").user(activeUser)
                    .expiresAt(Instant.now().plus(30, ChronoUnit.MINUTES)).used(true).build();

            ResetPasswordRequest req = new ResetPasswordRequest();
            req.setToken("used-token");
            req.setNewPassword("new");

            when(resetTokenRepository.findByToken("used-token")).thenReturn(Optional.of(resetToken));

            assertThatThrownBy(() -> authService.resetPassword(req))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void tokenExpirado_lanzaBusinessException() {
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token("expired-token").user(activeUser)
                    .expiresAt(Instant.now().minus(1, ChronoUnit.MINUTES)).used(false).build();

            ResetPasswordRequest req = new ResetPasswordRequest();
            req.setToken("expired-token");
            req.setNewPassword("new");

            when(resetTokenRepository.findByToken("expired-token")).thenReturn(Optional.of(resetToken));

            assertThatThrownBy(() -> authService.resetPassword(req))
                    .isInstanceOf(BusinessException.class);
        }
    }
}
