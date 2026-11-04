package com.tiendaropa.repository;

import com.tiendaropa.entity.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndProductId(Long userId, Long productId);

    Optional<WishlistItem> findByUserIdAndProductId(Long userId, Long productId);

    void deleteByUserIdAndProductId(Long userId, Long productId);

    /** Returns all wishlist entries for a product — used to notify users when stock is replenished. */
    @Query("SELECT wi FROM WishlistItem wi WHERE wi.productId = :productId")
    List<WishlistItem> findByProductId(@Param("productId") Long productId);
}
