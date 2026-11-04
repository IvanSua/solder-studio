package com.tiendaropa.service;

import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.JwtTokenProvider;
import com.tiendaropa.security.SecurityEventLogger;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

/**
 * Manages TOTP-based two-factor authentication.
 *
 * <p>Extracted from {@link AuthService} to keep authentication concerns separated:
 * <ul>
 *   <li>{@link AuthService} — registration, login, email verification, password reset</li>
 *   <li>{@code TwoFactorService} — TOTP setup and verification</li>
 *   <li>{@link TokenService} — JWT issuance, refresh rotation, logout/blacklisting</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class TwoFactorService {

    private final UserRepository userRepository;
    private final TotpService totpService;
    private final JwtTokenProvider tokenProvider;
    private final TokenService tokenService;
    private final SecurityEventLogger securityEvents;

    // ── Setup ─────────────────────────────────────────────────────────────────

    /**
     * Step 1 — generates a TOTP secret and stores it on the user.
     * Returns the Base32 secret + otpauth:// URI for QR code rendering.
     * 2FA is NOT active until {@link #enable2FA} is called successfully.
     */
    @Transactional
    public Map<String, String> setup2FA(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String secret = totpService.generateSecret();
        user.setTwoFactorSecret(secret);
        userRepository.save(user);

        String uri = totpService.buildOtpAuthUri(user.getEmail(), secret);
        return Map.of("secret", secret, "otpauthUri", uri);
    }

    /**
     * Step 2 — verifies the first TOTP code and activates 2FA for the account.
     */
    @Transactional
    public void enable2FA(Long userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (user.getTwoFactorSecret() == null) {
            throw new BusinessException("2FA no fue configurado. Llamá a /2fa/setup primero.", HttpStatus.BAD_REQUEST);
        }
        if (!totpService.verifyCode(user.getTwoFactorSecret(), code)) {
            throw new BusinessException("Código incorrecto. Intentá nuevamente.", HttpStatus.BAD_REQUEST);
        }

        user.setTwoFactorEnabled(true);
        userRepository.save(user);
        securityEvents.twoFactorEnabled(userId);
    }

    /**
     * Disables 2FA after verifying one last TOTP code (prevents accidental disabling).
     */
    @Transactional
    public void disable2FA(Long userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (!user.isTwoFactorEnabled()) return;

        if (!totpService.verifyCode(user.getTwoFactorSecret(), code)) {
            throw new BusinessException("Código incorrecto.", HttpStatus.BAD_REQUEST);
        }

        user.setTwoFactorEnabled(false);
        user.setTwoFactorSecret(null);
        userRepository.save(user);
        securityEvents.twoFactorDisabled(userId);
    }

    // ── Verification ──────────────────────────────────────────────────────────

    /**
     * Final login step when 2FA is required.
     * Validates the temp token + TOTP code, then issues real JWT tokens.
     */
    public AuthResponse verifyTwoFactor(String tempToken, String code) {
        if (!tokenProvider.validateToken(tempToken) || !tokenProvider.isTempToken(tempToken)) {
            throw new BusinessException("Token temporal inválido o expirado.", HttpStatus.UNAUTHORIZED);
        }

        Long userId = tokenProvider.getUserIdFromToken(tempToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (!totpService.verifyCode(user.getTwoFactorSecret(), code)) {
            securityEvents.twoFactorFailed(userId, resolveClientIp());
            throw new BusinessException("Código 2FA incorrecto.", HttpStatus.UNAUTHORIZED);
        }

        securityEvents.twoFactorSuccess(userId, resolveClientIp());
        securityEvents.loginSuccess(userId, user.getEmail(), resolveClientIp());
        return tokenService.buildAuthResponse(user);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String resolveClientIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return "unknown";
            HttpServletRequest req = attrs.getRequest();
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
            String realIp = req.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) return realIp.trim();
            return req.getRemoteAddr();
        } catch (Exception ex) {
            return "unknown";
        }
    }
}
