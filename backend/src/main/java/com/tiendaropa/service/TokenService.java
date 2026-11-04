package com.tiendaropa.service;

import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.dto.response.UserResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.security.JwtTokenProvider;
import com.tiendaropa.security.SecurityEventLogger;
import com.tiendaropa.security.TokenBlacklistService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Owns the JWT token lifecycle: issuing, refreshing, and revoking tokens.
 *
 * <p>Extracted from {@link AuthService} to keep authentication concerns separated:
 * <ul>
 *   <li>{@link AuthService} — registration, login, email verification, password reset</li>
 *   <li>{@link TwoFactorService} — TOTP setup and verification</li>
 *   <li>{@code TokenService} — JWT issuance, refresh rotation, logout/blacklisting</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtTokenProvider tokenProvider;
    private final TokenBlacklistService blacklistService;
    private final SecurityEventLogger securityEvents;
    private final UserRepository userRepository;

    // ── Build JWT responses ───────────────────────────────────────────────────

    /**
     * Issues a new access + refresh token pair for the given user.
     */
    public AuthResponse buildAuthResponse(User user) {
        String role = user.getRole().name();
        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail(), role);
        String refreshToken = tokenProvider.generateRefreshToken(user.getId(), user.getEmail(), role);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getExpirationMs() / 1000)
                .user(UserResponse.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .phone(user.getPhone())
                        .cuit(user.getCuit())
                        .role(role)
                        .enabled(user.isEnabled())
                        .emailVerified(user.isEmailVerified())
                        .createdAt(user.getCreatedAt())
                        .build())
                .build();
    }

    /**
     * Returns the partial AuthResponse issued when 2FA is required.
     * Contains only a short-lived temp token — no real access token.
     */
    public AuthResponse tempTokenResponse(Long userId) {
        return AuthResponse.builder()
                .requiresTwoFactor(true)
                .tempToken(tokenProvider.generateTempToken(userId))
                .build();
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    /**
     * Validates the provided refresh token and issues a new access + refresh token pair.
     * Refresh tokens are rotated on each use for better security.
     */
    @Transactional(readOnly = true)
    public AuthResponse refreshToken(String refreshToken) {
        if (!tokenProvider.validateToken(refreshToken) || !tokenProvider.isRefreshToken(refreshToken)) {
            throw new BusinessException("Refresh token inválido o expirado", HttpStatus.UNAUTHORIZED);
        }

        Long userId = tokenProvider.getUserIdFromToken(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", HttpStatus.UNAUTHORIZED));

        if (!user.isEnabled()) {
            throw new BusinessException("La cuenta está deshabilitada", HttpStatus.UNAUTHORIZED);
        }

        securityEvents.tokenRefreshed(userId, resolveClientIp());
        return buildAuthResponse(user);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Revokes the provided access token by adding its JTI to the blacklist.
     * The entry auto-expires in Redis when the token would have expired naturally.
     */
    public void logout(String accessToken) {
        if (!tokenProvider.validateToken(accessToken)) return;
        String jti = tokenProvider.getJtiFromToken(accessToken);
        if (jti != null) {
            Long userId = tokenProvider.getUserIdFromToken(accessToken);
            blacklistService.revoke(jti, tokenProvider.getExpirationFromToken(accessToken));
            securityEvents.logout(userId, resolveClientIp());
            securityEvents.tokenRevoked(userId, jti);
        }
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
