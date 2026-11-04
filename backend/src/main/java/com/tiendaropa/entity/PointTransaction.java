package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "point_transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PointTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Positive = earn, negative = spend */
    @Column(nullable = false)
    private Integer amount;

    /** e.g. "ORDER_DELIVERED", "REFERRAL_BONUS", "REFERRED_SIGNUP" */
    @Column(nullable = false, length = 60)
    private String reason;

    /** Order id, referral user id, etc. — nullable */
    private Long referenceId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
