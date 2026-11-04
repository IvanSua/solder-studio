package com.tiendaropa.repository;

import com.tiendaropa.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findByUserId(Long userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    boolean existsByUserIdAndEndpoint(Long userId, String endpoint);

    @Modifying
    @Query("DELETE FROM PushSubscription p WHERE p.endpoint = :endpoint")
    void deleteByEndpoint(@Param("endpoint") String endpoint);

    @Modifying
    @Query("DELETE FROM PushSubscription p WHERE p.userId = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
