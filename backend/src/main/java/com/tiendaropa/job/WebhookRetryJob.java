package com.tiendaropa.job;

import com.tiendaropa.config.properties.WebhookProperties;
import com.tiendaropa.entity.PaymentWebhookEvent;
import com.tiendaropa.enums.PaymentWebhookEventStatus;
import com.tiendaropa.repository.PaymentWebhookEventRepository;
import com.tiendaropa.service.PaymentWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

/**
 * Job que reintenta periódicamente webhooks fallidos.
 *
 * Solo procesa eventos con status=FAILED y next_retry_at <= now.
 * Si un evento ya superó MAX_RETRIES se descarta como PROCESSED para evitar loops.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebhookRetryJob {

    private static final int MAX_RETRIES = 5;

    private final PaymentWebhookEventRepository webhookEventRepository;
    private final PaymentWebhookService paymentWebhookService;
    private final WebhookProperties webhookProperties;

    /**
     * Corre cada 5 minutos.
     * Busca eventos FAILED con next_retry_at en el pasado y los re-encola.
     */
    @Scheduled(fixedDelayString = "${app.webhook.retry-interval-ms:300000}")
    public void retryFailedWebhooks() {
        List<PaymentWebhookEvent> candidates = webhookEventRepository
                .findRetryableEvents(PaymentWebhookEventStatus.FAILED, Instant.now(), Pageable.ofSize(webhookProperties.retryBatchSize()));

        if (candidates.isEmpty()) {
            return;
        }

        log.info("WebhookRetryJob: {} evento(s) para reintentar", candidates.size());

        for (PaymentWebhookEvent event : candidates) {
            if (event.getRetryCount() != null && event.getRetryCount() >= MAX_RETRIES) {
                log.warn("Webhook event {} superó MAX_RETRIES ({}) — descartando", event.getId(), MAX_RETRIES);
                event.setStatus(PaymentWebhookEventStatus.PROCESSED);
                event.setLastError("Descartado tras " + MAX_RETRIES + " intentos fallidos");
                webhookEventRepository.save(event);
                continue;
            }

            try {
                paymentWebhookService.retryEvent(event);
            } catch (Exception e) {
                log.error("Error reintentando webhook event {}: {}", event.getId(), e.getMessage());
            }
        }
    }
}
