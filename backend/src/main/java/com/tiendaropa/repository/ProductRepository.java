package com.tiendaropa.repository;

import com.tiendaropa.entity.Category;
import com.tiendaropa.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    Page<Product> findByActiveTrueAndCategoryId(Long categoryId, Pageable pageable);

    Page<Product> findByActiveTrue(Pageable pageable);

    Optional<Product> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Returns [slug, updatedAt] pairs for all active products — used by sitemap generator. */
    @Query("SELECT p.slug, p.updatedAt FROM Product p WHERE p.active = true ORDER BY p.updatedAt DESC")
    List<Object[]> findAllActiveSlugsWithDate();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.variants WHERE p.id = :id")
    Optional<Product> findByIdWithVariantsAndImages(@Param("id") Long id);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.variants WHERE p.slug = :slug AND p.active = true")
    Optional<Product> findBySlugWithVariants(@Param("slug") String slug);

    @Query("SELECT p FROM Product p WHERE p.active = true AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Product> search(@Param("query") String query, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true " +
           "AND (:categoryId IS NULL OR p.category.id = :categoryId) " +
           "AND (:query IS NULL OR :query = '' " +
           "     OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "     OR LOWER(p.description) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Product> findFiltered(
            @Param("categoryId") Long categoryId,
            @Param("query") String query,
            Pageable pageable);

    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN FETCH p.images i LEFT JOIN p.variants v " +
           "WHERE p.active = true AND LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "AND v.active = true ORDER BY p.name ASC")
    List<Product> findAutocomplete(@Param("q") String q, Pageable pageable);

    @Query("SELECT DISTINCT v.size FROM ProductVariant v WHERE v.product.active = true AND v.active = true ORDER BY v.size")
    List<String> findDistinctSizes();

    @Query("SELECT DISTINCT v.color FROM ProductVariant v WHERE v.product.active = true AND v.active = true ORDER BY v.color")
    List<String> findDistinctColors();

    @Query("SELECT MIN(v.priceAmount) FROM ProductVariant v WHERE v.product.active = true AND v.active = true")
    Long findMinPrice();

    @Query("SELECT MAX(v.priceAmount) FROM ProductVariant v WHERE v.product.active = true AND v.active = true")
    Long findMaxPrice();

    @Query("SELECT p FROM Product p WHERE p.category = :category AND p.id != :excludeId AND p.active = true ORDER BY p.createdAt DESC")
    List<Product> findRelatedByCategory(@Param("category") Category category, @Param("excludeId") Long excludeId, Pageable pageable);

    /**
     * Finds products frequently bought together with the given product.
     * Returns products that appear in orders containing the specified product,
     * ordered by co-purchase frequency (most frequently bought together first).
     */
    @Query(value = """
        SELECT p.*, COUNT(oi2.id) as co_purchase_count
        FROM products p
        JOIN product_variants pv ON pv.product_id = p.id
        JOIN order_items oi2 ON oi2.product_variant_id = pv.id
        JOIN orders o ON o.id = oi2.order_id
        WHERE o.id IN (
            SELECT DISTINCT o2.id
            FROM orders o2
            JOIN order_items oi ON oi.order_id = o2.id
            JOIN product_variants pv2 ON pv2.id = oi.product_variant_id
            WHERE pv2.product_id = :productId
            AND o2.status IN ('PAID', 'DELIVERED')
        )
        AND p.id != :productId
        AND p.active = true
        GROUP BY p.id
        ORDER BY co_purchase_count DESC
        """, nativeQuery = true)
    List<Product> findFrequentlyBoughtTogether(@Param("productId") Long productId, Pageable pageable);
}
