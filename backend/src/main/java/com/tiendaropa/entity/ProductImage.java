package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product_images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String imageUrl;

    private String altText;

    @Column(nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = false;
}
