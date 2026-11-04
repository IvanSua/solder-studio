package com.tiendaropa.repository;

import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.enums.DesignStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CustomDesignRepository extends JpaRepository<CustomDesign, Long> {

    List<CustomDesign> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<CustomDesign> findByIdAndUserId(Long id, Long userId);

    /**
     * Finds DRAFT designs older than the given cutoff instant.
     * Used by the cleanup job to purge abandoned customiser sessions.
     */
    @Query("SELECT d FROM CustomDesign d WHERE d.status = :status AND d.createdAt < :cutoff")
    List<CustomDesign> findByStatusAndCreatedAtBefore(
            @Param("status") DesignStatus status,
            @Param("cutoff") Instant cutoff);
}
