package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "push_subscriptions",
        uniqueConstraints = @UniqueConstraint(name = "uq_push_endpoint", columnNames = "endpoint"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String endpoint;

    /** DH public key (Base64url) */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String p256dh;

    /** Auth secret (Base64url) */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String auth;

    @Column(length = 500)
    private String userAgent;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column
    private Instant lastUsedAt;
}
