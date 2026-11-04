package com.tiendaropa.service;

import com.tiendaropa.dto.response.NotificationResponse;
import com.tiendaropa.entity.Notification;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.NotificationRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock NotificationRepository notificationRepository;

    @InjectMocks NotificationService notificationService;

    private Notification buildNotification(Long id, Long userId, boolean read) {
        return Notification.builder()
                .id(id)
                .userId(userId)
                .type(NotificationType.ORDER_SHIPPED)
                .title("Pedido enviado")
                .message("Tu pedido está en camino")
                .link("/orders/" + id)
                .read(read)
                .createdAt(Instant.now())
                .build();
    }

    // ── countUnread ───────────────────────────────────────────────────────────

    @Nested
    class CountUnread {

        @Test
        void delegatesToRepository() {
            when(notificationRepository.countByUserIdAndReadFalse(1L)).thenReturn(5L);

            assertThat(notificationService.countUnread(1L)).isEqualTo(5L);
        }

        @Test
        void returnsZeroWhenNoUnread() {
            when(notificationRepository.countByUserIdAndReadFalse(1L)).thenReturn(0L);

            assertThat(notificationService.countUnread(1L)).isZero();
        }
    }

    // ── getNotifications ─────────────────────────────────────────────────────

    @Nested
    class GetNotifications {

        @Test
        void returnsMappedPage() {
            Notification n = buildNotification(1L, 10L, false);
            Page<Notification> page = new PageImpl<>(List.of(n));
            PageRequest pageable = PageRequest.of(0, 10);

            when(notificationRepository.findByUserIdOrderByCreatedAtDesc(10L, pageable))
                    .thenReturn(page);

            Page<NotificationResponse> result =
                    notificationService.getNotifications(10L, pageable);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getId()).isEqualTo(1L);
        }
    }

    // ── markRead ─────────────────────────────────────────────────────────────

    @Nested
    class MarkRead {

        @Test
        void marksOwnNotificationAsRead() {
            Notification n = buildNotification(1L, 10L, false);
            when(notificationRepository.findById(1L)).thenReturn(Optional.of(n));
            when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            NotificationResponse result = notificationService.markRead(10L, 1L);

            assertThat(result.isRead()).isTrue();
            verify(notificationRepository).save(n);
        }

        @Test
        void throwsWhenNotificationBelongsToAnotherUser() {
            Notification n = buildNotification(1L, 99L, false); // belongs to user 99
            when(notificationRepository.findById(1L)).thenReturn(Optional.of(n));

            // Caller is user 10, not 99
            assertThatThrownBy(() -> notificationService.markRead(10L, 1L))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(notificationRepository, never()).save(any());
        }

        @Test
        void throwsWhenNotificationNotFound() {
            when(notificationRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> notificationService.markRead(1L, 404L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ── markAllRead ───────────────────────────────────────────────────────────

    @Nested
    class MarkAllRead {

        @Test
        void returnsCountFromRepository() {
            when(notificationRepository.markAllReadByUserId(1L)).thenReturn(3);

            assertThat(notificationService.markAllRead(1L)).isEqualTo(3);
        }
    }
}
