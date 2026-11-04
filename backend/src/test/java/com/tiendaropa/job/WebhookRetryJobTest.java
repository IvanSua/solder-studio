package com.tiendaropa.job;

import com.tiendaropa.config.properties.WebhookProperties;
import com.tiendaropa.entity.PaymentWebhookEvent;
import com.tiendaropa.enums.PaymentWebhookEventStatus;
import com.tiendaropa.repository.PaymentWebhookEventRepository;
import com.tiendaropa.service.PaymentWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebhookRetryJobTest {

    @Mock PaymentWebhookEventRepository webhookEventRepository;
    @Mock PaymentWebhookService paymentWebhookService;
    @Mock WebhookProperties webhookProperties;

    @InjectMocks WebhookRetryJob webhookRetryJob;

    @BeforeEach
    void setUp() {
        when(webhookProperties.retryBatchSize()).thenReturn(10);
    }

    private PaymentWebhookEvent failedEvent(Long id, int retryCount) {
        return PaymentWebhookEvent.builder()
                .id(id)
                .paymentExternalId("pay_" + id)
                .status(PaymentWebhookEventStatus.FAILED)
                .retryCount(retryCount)
                .nextRetryAt(Instant.now().minusSeconds(60))
                .build();
    }

    // ─── No candidates ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("No retryable events")
    class NoCandidates {

        @Test
        @DisplayName("does nothing when queue is empty")
        void doesNothingWhenEmpty() {
            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of());

            webhookRetryJob.retryFailedWebhooks();

            verifyNoInteractions(paymentWebhookService);
            verify(webhookEventRepository, never()).save(any());
        }
    }

    // ─── Normal retry ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Normal retry flow")
    class NormalRetry {

        @Test
        @DisplayName("calls retryEvent for each candidate under MAX_RETRIES")
        void callsRetryEventForEachCandidate() {
            PaymentWebhookEvent e1 = failedEvent(1L, 1);
            PaymentWebhookEvent e2 = failedEvent(2L, 2);

            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of(e1, e2));

            webhookRetryJob.retryFailedWebhooks();

            verify(paymentWebhookService).retryEvent(e1);
            verify(paymentWebhookService).retryEvent(e2);
        }

        @Test
        @DisplayName("continues processing other events when one throws")
        void continuesOnException() {
            PaymentWebhookEvent e1 = failedEvent(1L, 1);
            PaymentWebhookEvent e2 = failedEvent(2L, 1);

            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of(e1, e2));

            doThrow(new RuntimeException("MP down")).when(paymentWebhookService).retryEvent(e1);

            assertThatCode(() -> webhookRetryJob.retryFailedWebhooks())
                    .doesNotThrowAnyException();

            // e2 must still be attempted despite e1 failing
            verify(paymentWebhookService).retryEvent(e2);
        }
    }

    // ─── MAX_RETRIES exceeded ─────────────────────────────────────────────────

    @Nested
    @DisplayName("MAX_RETRIES exceeded")
    class MaxRetriesExceeded {

        @Test
        @DisplayName("marks event as PROCESSED when retryCount >= 5")
        void marksAsProcessedWhenMaxRetriesReached() {
            PaymentWebhookEvent exhausted = failedEvent(99L, 5); // 5 == MAX_RETRIES

            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of(exhausted));
            when(webhookEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            webhookRetryJob.retryFailedWebhooks();

            verify(paymentWebhookService, never()).retryEvent(any());

            ArgumentCaptor<PaymentWebhookEvent> captor = ArgumentCaptor.forClass(PaymentWebhookEvent.class);
            verify(webhookEventRepository).save(captor.capture());

            PaymentWebhookEvent saved = captor.getValue();
            assertThat(saved.getStatus()).isEqualTo(PaymentWebhookEventStatus.PROCESSED);
            assertThat(saved.getLastError()).contains("5");
        }

        @Test
        @DisplayName("retryCount of 4 is still retried (below MAX_RETRIES)")
        void retryCountFourIsStillRetried() {
            PaymentWebhookEvent event = failedEvent(10L, 4);

            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of(event));

            webhookRetryJob.retryFailedWebhooks();

            verify(paymentWebhookService).retryEvent(event);
            verify(webhookEventRepository, never()).save(any());
        }

        @Test
        @DisplayName("mixed batch — exhausted events are discarded, others are retried")
        void mixedBatchHandledCorrectly() {
            PaymentWebhookEvent exhausted = failedEvent(1L, 5);
            PaymentWebhookEvent normal = failedEvent(2L, 2);

            when(webhookEventRepository.findRetryableEvents(
                    eq(PaymentWebhookEventStatus.FAILED), any(Instant.class), any(Pageable.class)))
                    .thenReturn(List.of(exhausted, normal));
            when(webhookEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            webhookRetryJob.retryFailedWebhooks();

            verify(webhookEventRepository).save(exhausted); // discarded
            verify(paymentWebhookService).retryEvent(normal); // retried
            verify(paymentWebhookService, never()).retryEvent(exhausted);
        }
    }
}
