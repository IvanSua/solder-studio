package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "saved_sizes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "category_name"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SavedSize {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String categoryName;

    @Column(nullable = false, length = 20)
    private String size;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
