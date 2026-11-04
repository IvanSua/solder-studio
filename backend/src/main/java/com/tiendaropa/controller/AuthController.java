package com.tiendaropa.controller;

import com.tiendaropa.dto.request.ForgotPasswordRequest;
import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.OAuthExchangeRequest;
import com.tiendaropa.dto.request.RefreshTokenRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.request.ResetPasswordRequest;
import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.service.AuthService;
import com.tiendaropa.service.TokenService;
import com.tiendaropa.service.TwoFactorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TokenService tokenService;
    private final TwoFactorService twoFactorService;

    // ── Registration & Login ──────────────────────────────────────────────────

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // ── OAuth2 code exchange ──────────────────────────────────────────────────

    /**
     * Exchanges the short-lived OAuth2 one-time code (from the redirect URL)
     * for real JWT tokens. The code expires in 30 seconds and can only be used once.
     */
    @PostMapping("/oauth-exchange")
    public AuthResponse oauthExchange(@Valid @RequestBody OAuthExchangeRequest request) {
        return authService.exchangeOAuthCode(request);
    }

    // ── Token management ──────────────────────────────────────────────────────

    /**
     * Revokes the current access token.
     * The token JTI is added to the Redis blacklist with TTL = remaining token lifetime.
     */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            tokenService.logout(header.substring(7));
        }
    }

    /**
     * Issues a new access + refresh token pair using a valid refresh token.
     * The old refresh token is implicitly rotated — store the new one.
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return tokenService.refreshToken(request.refreshToken());
    }

    // ── Password reset ────────────────────────────────────────────────────────

    /** Initiates forgot-password flow. Always returns 200 to prevent user enumeration. */
    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return Map.of("message", "Si el email existe en nuestra base recibirás un enlace para restablecer tu contraseña.");
    }

    /** Validates reset token and sets the new password. */
    @PostMapping("/reset-password")
    public Map<String, String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return Map.of("message", "Contraseña actualizada correctamente. Ya podés iniciar sesión.");
    }

    // ── Email verification ────────────────────────────────────────────────────

    @GetMapping("/verify-email")
    public Map<String, String> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return Map.of("message", "Email verificado correctamente. Ya podés iniciar sesión.");
    }

    @PostMapping("/resend-verification")
    public Map<String, String> resendVerification(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email != null && !email.isBlank()) {
            authService.resendVerificationEmail(email.trim().toLowerCase());
        }
        return Map.of("message", "Si el email existe y no está verificado, recibirás un nuevo enlace.");
    }

    // ── Two-factor authentication ─────────────────────────────────────────────

    /**
     * Step 1: Authenticated user requests 2FA setup.
     * Returns the Base32 secret and otpauth:// URI (for QR code rendering).
     * 2FA is NOT yet active until /2fa/enable is called successfully.
     */
    @PostMapping("/2fa/setup")
    public Map<String, String> setup2FA(Authentication auth) {
        return twoFactorService.setup2FA((Long) auth.getPrincipal());
    }

    /**
     * Step 2: Confirms the first TOTP code and activates 2FA.
     */
    @PostMapping("/2fa/enable")
    public Map<String, String> enable2FA(Authentication auth,
                                         @RequestBody Map<String, String> body) {
        twoFactorService.enable2FA((Long) auth.getPrincipal(), body.get("code"));
        return Map.of("message", "Autenticación de dos factores activada correctamente.");
    }

    /**
     * Disables 2FA. Requires current TOTP code to prevent accidental disabling.
     */
    @PostMapping("/2fa/disable")
    public Map<String, String> disable2FA(Authentication auth,
                                          @RequestBody Map<String, String> body) {
        twoFactorService.disable2FA((Long) auth.getPrincipal(), body.get("code"));
        return Map.of("message", "Autenticación de dos factores desactivada.");
    }

    /**
     * Final login step when requiresTwoFactor = true.
     * Accepts the temp token from the login response + the TOTP code.
     * Returns a full AuthResponse with real JWT tokens.
     */
    @PostMapping("/2fa/verify")
    public AuthResponse verify2FA(@RequestBody Map<String, String> body) {
        return twoFactorService.verifyTwoFactor(body.get("tempToken"), body.get("code"));
    }
}
