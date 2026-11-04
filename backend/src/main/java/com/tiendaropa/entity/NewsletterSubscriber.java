package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "newsletter_subscribers",
       uniqueConstraints = @UniqueConstraint(columnNames = "email", name = "uq_newsletter_email"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsletterSubscriber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Friendly name — may be null for standalone sign-ups */
    private String name;

    /** How the subscriber joined: REGISTRATION, MANUAL */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String source = "REGISTRATION";

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant subscribedAt;
}
