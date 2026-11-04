package com.tiendaropa.repository;

import com.tiendaropa.entity.RecentlyViewed;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecentlyViewedRepository extends JpaRepository<RecentlyViewed, Long> {

    @Query("SELECT rv FROM RecentlyViewed rv WHERE rv.userId = :userId AND rv.productId != :excludeProductId ORDER BY rv.viewedAt DESC")
    List<RecentlyViewed> findRecentByUserIdExcluding(@Param("userId") Long userId, @Param("excludeProductId") Long excludeProductId, Pageable pageable);

    @Query("SELECT rv FROM RecentlyViewed rv WHERE rv.userId = :userId ORDER BY rv.viewedAt DESC")
    List<RecentlyViewed> findRecentByUserId(@Param("userId") Long userId, Pageable pageable);

    Optional<RecentlyViewed> findByUserIdAndProductId(Long userId, Long productId);

    long countByUserId(Long userId);

    /**
     * Deletes the :excess oldest entries for the given user, keeping only the
     * MAX_RECENTLY_VIEWED most recent ones. Uses a native subquery because JPQL
     * does not support LIMIT inside DELETE.
     */
    @Modifying
    @Query(value = """
            DELETE FROM recently_viewed
            WHERE user_id = :userId
              AND id IN (
                  SELECT id FROM recently_viewed
                  WHERE user_id = :userId
                  ORDER BY viewed_at ASC
                  LIMIT :excess
              )
            """, nativeQuery = true)
    void deleteOldestForUser(@Param("userId") Long userId, @Param("excess") long excess);
}
