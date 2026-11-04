package com.tiendaropa.repository;

import com.tiendaropa.entity.PaymentWebhookEvent;
import com.tiendaropa.enums.PaymentWebhookEventStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository para PaymentWebhookEvent.
 * Usado para verificar idempotencia de webhooks.
 */
@Repository
public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent, Long> {

    /**
     * Busca un evento por el ID externo de MercadoPago.
     */
    Optional<PaymentWebhookEvent> findByPaymentExternalId(String paymentExternalId);

    /**
     * Verifica si ya existe un evento para este payment ID.
     */
    boolean existsByPaymentExternalId(String paymentExternalId);

    /**
     * Busca eventos fallidos cuyo next_retry_at ya pasó (listos para reintento).
     * Usar Pageable.ofSize(n) para limitar el batch.
     */
    @Query("""
            SELECT e FROM PaymentWebhookEvent e
            WHERE e.status = :status
              AND e.nextRetryAt IS NOT NULL
              AND e.nextRetryAt <= :now
            ORDER BY e.nextRetryAt ASC
            """)
    List<PaymentWebhookEvent> findRetryableEvents(
            @Param("status") PaymentWebhookEventStatus status,
            @Param("now") Instant now,
            Pageable pageable);
}
