package com.tiendaropa.entity;

import com.tiendaropa.enums.PaymentWebhookEventStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Registra los webhooks de MercadoPago recibidos para garantizar idempotencia.
 * Si el mismo paymentExternalId llega dos veces, el segundo se ignora.
 */
@Entity
@Table(name = "payment_webhook_events", indexes = {
    @Index(name = "idx_payment_external_id", columnList = "payment_external_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * ID externo del pago en MercadoPago (ej: "1234567890").
     * Único para evitar duplicados.
     */
    @Column(name = "payment_external_id", nullable = false, unique = true)
    private String paymentExternalId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentWebhookEventStatus status;

    /**
     * ID de la orden asociada (puede ser null si el externalReference no se encontró).
     */
    @Column(name = "order_id")
    private Long orderId;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    /**
     * Hash SHA-256 del payload para debugging.
     */
    @Column(name = "payload_hash", length = 64)
    private String payloadHash;

    /** Número de intentos de procesamiento */
    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    /** Mensaje del último error para debugging */
    @Column(name = "last_error", length = 500)
    private String lastError;

    /** Cuándo se debe reintentar (null = no programado) */
    @Column(name = "next_retry_at")
    private Instant nextRetryAt;
}
