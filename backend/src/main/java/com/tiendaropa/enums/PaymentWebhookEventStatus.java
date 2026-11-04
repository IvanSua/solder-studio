package com.tiendaropa.enums;

/**
 * Status de un evento de webhook de MercadoPago.
 */
public enum PaymentWebhookEventStatus {
    /** Evento recibido pero aún no procesado */
    PENDING,
    /** Pago aprobado - orden marcada como PAID */
    APPROVED,
    /** Pago rechazado - orden cancelada */
    REJECTED,
    /** Pago cancelado - orden cancelada */
    CANCELLED,
    /** Webhook duplicado - ignorado */
    DUPLICATE,
    /** Pago pendiente - sin acción */
    PENDING_PAYMENT,
    /** Evento completamente procesado */
    PROCESSED,
    /** Fallo transitorio — se reintentará automáticamente */
    FAILED
}
