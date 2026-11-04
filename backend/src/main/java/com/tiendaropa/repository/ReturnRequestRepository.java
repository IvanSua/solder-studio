package com.tiendaropa.repository;

import com.tiendaropa.entity.ReturnRequest;
import com.tiendaropa.enums.ReturnStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReturnRequestRepository extends JpaRepository<ReturnRequest, Long> {

    /** All returns for a specific user */
    List<ReturnRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Check if an order already has an open (non-rejected, non-completed) return */
    boolean existsByOrderIdAndStatusNotIn(Long orderId, List<ReturnStatus> statuses);

    /** Find a single return by id, verifying it belongs to the user */
    @Query("SELECT r FROM ReturnRequest r WHERE r.id = :id AND r.user.id = :userId")
    Optional<ReturnRequest> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /** Admin: paginated list optionally filtered by status */
    Page<ReturnRequest> findByStatusOrderByCreatedAtDesc(ReturnStatus status, Pageable pageable);

    /** Admin: all returns, newest first */
    Page<ReturnRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
