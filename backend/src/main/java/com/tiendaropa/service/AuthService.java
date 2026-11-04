package com.tiendaropa.service;

import com.tiendaropa.dto.request.ForgotPasswordRequest;
import com.tiendaropa.dto.request.LoginRequest;
import com.tiendaropa.dto.request.OAuthExchangeRequest;
import com.tiendaropa.dto.request.RegisterRequest;
import com.tiendaropa.dto.request.ResetPasswordRequest;
import com.tiendaropa.dto.response.AuthResponse;
import com.tiendaropa.entity.NewsletterSubscriber;
import com.tiendaropa.entity.PasswordResetToken;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.NewsletterRepository;
import com.tiendaropa.repository.PasswordResetTokenRepository;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.config.properties.AuthProperties;
import com.tiendaropa.security.OAuthCodeStore;
import com.tiendaropa.security.SecurityEventLogger;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Handles user registration, login, email verification and password reset.
 *
 * <p>Responsibilities are split across three services:
 * <ul>
 *   <li>{@code AuthService} — registration, login, email verification, password reset</li>
 *   <li>{@link TwoFactorService} — TOTP setup and verification</li>
 *   <li>{@link TokenService} — JWT issuance, refresh rotation, logout/blacklisting</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final AuthProperties authProperties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final SecurityEventLogger securityEvents;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final EmailService emailService;
    private final PointsService pointsService;
    private final NewsletterRepository newsletterRepository;
    private final OAuthCodeStore oAuthCodeStore;

    // ── Registration ──────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email already registered", HttpStatus.CONFLICT);
        }

        User referrer = null;
        if (request.getReferralCode() != null && !request.getReferralCode().isBlank()) {
            referrer = userRepository.findByReferralCode(request.getReferralCode().trim().toUpperCase())
                    .orElse(null);
        }

        byte[] verifyBytes = new byte[32];
        SECURE_RANDOM.nextBytes(verifyBytes);
        String verificationToken = HexFormat.of().formatHex(verifyBytes);

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .phone(request.getPhone())
                .referralCode(generateUniqueReferralCode(request.getFirstName()))
                .referredBy(referrer)
                .emailVerified(false)
                .emailVerificationToken(verificationToken)
                .emailVerificationExpiresAt(Instant.now().plus(authProperties.verificationTokenHours(), ChronoUnit.HOURS))
                .build();

        user = userRepository.save(user);
        securityEvents.registered(user.getId(), user.getEmail(), resolveClientIp());

        if (referrer != null) {
            final Long newUserId = user.getId();
            final Long referrerId = referrer.getId();
            pointsService.awardPoints(newUserId,  50,  "REFERRED_SIGNUP", referrerId);
            pointsService.awardPoints(referrerId, 200, "REFERRAL_BONUS",  newUserId);
        }

        if (request.isNewsletterOptIn() && !newsletterRepository.existsByEmail(user.getEmail())) {
            newsletterRepository.save(NewsletterSubscriber.builder()
                    .email(user.getEmail())
                    .name(user.getFirstName() + " " + user.getLastName())
                    .source("REGISTRATION")
                    .build());
        }

        emailService.sendWelcomeEmail(user.getEmail(), user.getFirstName(), user.getReferralCode());
        emailService.sendVerificationEmail(user.getEmail(), user.getFirstName(), verificationToken);

        return tokenService.buildAuthResponse(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            long minutesLeft = ChronoUnit.MINUTES.between(Instant.now(), user.getLockedUntil()) + 1;
            throw new BusinessException(
                    "Account temporarily locked. Try again in " + minutesLeft + " minute(s).",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        if (!user.isEnabled()) {
            throw new BusinessException("Account is disabled", HttpStatus.FORBIDDEN);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= authProperties.maxFailedAttempts()) {
                user.setLockedUntil(Instant.now().plus(authProperties.lockoutMinutes(), ChronoUnit.MINUTES));
                securityEvents.accountLocked(user.getEmail(), attempts, resolveClientIp());
            } else {
                securityEvents.loginFailed(user.getEmail(), resolveClientIp(), "bad_credentials attempt=" + attempts);
            }
            userRepository.save(user);
            throw new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        if (user.getFailedLoginAttempts() > 0 || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        }

        if (user.isTwoFactorEnabled()) {
            return tokenService.tempTokenResponse(user.getId());
        }

        securityEvents.loginSuccess(user.getId(), user.getEmail(), resolveClientIp());
        return tokenService.buildAuthResponse(user);
    }

    // ── Email verification ────────────────────────────────────────────────────

    @Transactional
    public void verifyEmail(String token) {
        User user = userRepository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new BusinessException("Token de verificación inválido", HttpStatus.BAD_REQUEST));

        if (user.isEmailVerified()) return;

        if (user.getEmailVerificationExpiresAt() != null
                && user.getEmailVerificationExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("El enlace de verificación expiró. Podés solicitar uno nuevo.", HttpStatus.GONE);
        }

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiresAt(null);
        userRepository.save(user);
    }

    @Transactional
    public void resendVerificationEmail(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.isEmailVerified()) return;

            byte[] verifyBytes = new byte[32];
            SECURE_RANDOM.nextBytes(verifyBytes);
            String token = HexFormat.of().formatHex(verifyBytes);
            user.setEmailVerificationToken(token);
            user.setEmailVerificationExpiresAt(Instant.now().plus(authProperties.verificationTokenHours(), ChronoUnit.HOURS));
            userRepository.save(user);
            emailService.sendVerificationEmail(user.getEmail(), user.getFirstName(), token);
        });
    }

    // ── Password Reset ────────────────────────────────────────────────────────

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String ip = resolveClientIp();
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            securityEvents.passwordResetRequested(user.getEmail(), ip);
            resetTokenRepository.deleteExpiredAndUsed(Instant.now());

            byte[] bytes = new byte[32];
            SECURE_RANDOM.nextBytes(bytes);
            String token = HexFormat.of().formatHex(bytes);

            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token(token)
                    .user(user)
                    .expiresAt(Instant.now().plus(authProperties.tokenExpiryMinutes(), ChronoUnit.MINUTES))
                    .build();
            resetTokenRepository.save(resetToken);
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), token);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = resetTokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new BusinessException("Token inválido o expirado", HttpStatus.BAD_REQUEST));

        if (resetToken.isUsed()) {
            throw new BusinessException("Token inválido o expirado", HttpStatus.BAD_REQUEST);
        }
        if (resetToken.isExpired()) {
            throw new BusinessException("El token expiró. Solicitá un nuevo enlace.", HttpStatus.BAD_REQUEST);
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        resetTokenRepository.save(resetToken);
        securityEvents.passwordResetCompleted(user.getId());
    }

    // ── Referral code generation ──────────────────────────────────────────────

    private String generateUniqueReferralCode(String firstName) {
        String prefix = firstName.replaceAll("[^A-Za-z]", "")
                .toUpperCase(Locale.ROOT)
                .substring(0, Math.min(3, firstName.length()));
        if (prefix.length() < 3) prefix = (prefix + "XXX").substring(0, 3);

        for (int attempts = 0; attempts < 10; attempts++) {
            StringBuilder sb = new StringBuilder(prefix);
            for (int i = 0; i < 6; i++) {
                sb.append(REFERRAL_ALPHABET.charAt(SECURE_RANDOM.nextInt(REFERRAL_ALPHABET.length())));
            }
            String code = sb.toString();
            if (userRepository.findByReferralCode(code).isEmpty()) {
                return code;
            }
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            sb.append(REFERRAL_ALPHABET.charAt(SECURE_RANDOM.nextInt(REFERRAL_ALPHABET.length())));
        }
        return sb.toString();
    }

    // ── OAuth2 code exchange ──────────────────────────────────────────────────

    /**
     * Exchanges a short-lived OAuth2 one-time code for real JWT tokens.
     * The code is consumed atomically — replaying the same code returns 401.
     */
    @Transactional(readOnly = true)
    public AuthResponse exchangeOAuthCode(OAuthExchangeRequest request) {
        Long userId = oAuthCodeStore.consume(request.code())
                .orElseThrow(() -> new BusinessException(
                        "Código OAuth inválido o expirado.", HttpStatus.UNAUTHORIZED));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(
                        "Usuario no encontrado.", HttpStatus.UNAUTHORIZED));

        securityEvents.loginSuccess(user.getId(), user.getEmail(), resolveClientIp());
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
