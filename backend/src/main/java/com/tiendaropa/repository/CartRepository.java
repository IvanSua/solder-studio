package com.tiendaropa.repository;

import com.tiendaropa.entity.Cart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {

    @Query("SELECT c FROM Cart c LEFT JOIN FETCH c.items WHERE c.user.id = :userId")
    Optional<Cart> findByUserIdWithItems(@Param("userId") Long userId);

    /**
     * Returns carts that:
     * - have at least one item (SIZE > 0),
     * - were last updated before the given cutoff (i.e., inactive for X hours),
     * - belong to an enabled user,
     * - have NOT had an abandoned-cart email sent since the cutoff (tracked via cart.lastAbandonedEmailAt).
     */
    @Query("""
            SELECT c FROM Cart c
            JOIN FETCH c.items ci
            JOIN FETCH c.user u
            WHERE SIZE(c.items) > 0
              AND c.updatedAt < :cutoff
              AND u.enabled = true
              AND (c.lastAbandonedEmailAt IS NULL OR c.lastAbandonedEmailAt < :cutoff)
            """)
    List<Cart> findAbandonedCarts(@Param("cutoff") Instant cutoff);
}
