package com.tiendaropa.repository;

import com.tiendaropa.entity.ProductVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    List<ProductVariant> findByProductIdAndActiveTrue(Long productId);

    boolean existsByProductIdAndColorAndSize(Long productId, String color, String size);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM ProductVariant v WHERE v.id = :id")
    Optional<ProductVariant> findByIdForUpdate(@Param("id") Long id);

    /**
     * Fetches a variant together with its parent product, the product's images
     * and the product's print area — all in a single query.
     * Used by the customizer endpoint to avoid N+1 loads.
     */
    @Query("""
        SELECT v FROM ProductVariant v
        JOIN FETCH v.product p
        LEFT JOIN FETCH p.images
        LEFT JOIN FETCH p.printArea
        WHERE v.id = :id
        """)
    Optional<ProductVariant> findByIdWithProductDetails(@Param("id") Long id);

    /** All active variants with available stock (stockTotal - stockReserved) ≤ threshold, ordered ASC */
    @Query("""
            SELECT v FROM ProductVariant v JOIN FETCH v.product p
            WHERE v.active = true AND (v.stockTotal - v.stockReserved) <= :threshold
            ORDER BY (v.stockTotal - v.stockReserved) ASC, p.name ASC
            """)
    List<ProductVariant> findLowStock(@Param("threshold") int threshold);
}
