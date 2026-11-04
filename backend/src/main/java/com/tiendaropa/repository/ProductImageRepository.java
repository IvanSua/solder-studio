package com.tiendaropa.repository;

import com.tiendaropa.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    List<ProductImage> findByProductIdOrderBySortOrderAsc(Long productId);

    Optional<ProductImage> findByIdAndProductId(Long id, Long productId);

    /** Remove the primary flag from all images of a given product */
    @Modifying
    @Query("UPDATE ProductImage i SET i.primary = false WHERE i.product.id = :productId")
    void clearPrimaryForProduct(@Param("productId") Long productId);
}
