package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "design_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DesignAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "custom_design_id", nullable = false)
    private CustomDesign customDesign;

    @Column(nullable = false)
    private String originalFileUrl;

    @Column(nullable = false)
    private String normalizedFileUrl;

    @Column(nullable = false)
    private Integer widthPx;

    @Column(nullable = false)
    private Integer heightPx;

    @Column(nullable = false)
    private String mimeType;

    @Column(nullable = false)
    private Long fileSizeBytes;

    @Column(nullable = false)
    private String fileHash;

    @Column(nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
