package com.tiendaropa.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "print_areas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrintArea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, unique = true)
    private Product product;

    @Column(nullable = false)
    private Integer canvasWidth;

    @Column(nullable = false)
    private Integer canvasHeight;

    @Column(name = "printable_x", nullable = false)
    private Integer printableX;

    @Column(name = "printable_y", nullable = false)
    private Integer printableY;

    @Column(nullable = false)
    private Integer printableWidth;

    @Column(nullable = false)
    private Integer printableHeight;
}
