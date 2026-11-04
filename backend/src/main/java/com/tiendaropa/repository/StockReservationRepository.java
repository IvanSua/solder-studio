package com.tiendaropa.repository;

import com.tiendaropa.entity.StockReservation;
import com.tiendaropa.enums.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface StockReservationRepository extends JpaRepository<StockReservation, Long> {

    List<StockReservation> findByOrderId(Long orderId);

    @Query("SELECT r FROM StockReservation r WHERE r.status = :status AND r.expiresAt < :now")
    List<StockReservation> findExpiredReservations(@Param("status") ReservationStatus status,
                                                   @Param("now") Instant now);
}
