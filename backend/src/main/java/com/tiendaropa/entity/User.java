package com.tiendaropa.entity;

import com.tiendaropa.enums.UserLevel;
import com.tiendaropa.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    private String phone;

    /** CUIT/DNI for invoicing purposes — optional */
    @Column(length = 13)
    private String cuit;

    // ── Email verification ────────────────────────────────────────────────────
    @Column(nullable = false)
    @Builder.Default
    private boolean emailVerified = false;

    @Column(length = 64)
    private String emailVerificationToken;

    private Instant emailVerificationExpiresAt;

    // ── Two-factor authentication (TOTP) ─────────────────────────────────────
    @Column(nullable = false)
    @Builder.Default
    private boolean twoFactorEnabled = false;

    /** Base32-encoded TOTP secret, null when 2FA is not set up */
    @Column(length = 64)
    private String twoFactorSecret;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private UserRole role = UserRole.CUSTOMER;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    // ── Account lockout ───────────────────────────────────────────────────────
    @Column(nullable = false)
    @Builder.Default
    private Integer failedLoginAttempts = 0;

    /** Null means not locked. Set to a future instant to temporarily lock the account. */
    private Instant lockedUntil;

    @Column(nullable = false)
    @Builder.Default
    private Integer points = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UserLevel level = UserLevel.BRONZE;

    @Column(unique = true, length = 20)
    private String referralCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referred_by")
    private User referredBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
