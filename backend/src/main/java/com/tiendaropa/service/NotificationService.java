package com.tiendaropa.service;

import com.tiendaropa.dto.response.NotificationResponse;
import com.tiendaropa.entity.Notification;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final WebPushService webPushService;

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Fire-and-forget: persist in-app notification AND send a Web Push to all
     * subscribed devices. Never throws — failures are logged and swallowed.
     */
    @Async
    public void createAsync(Long userId, NotificationType type, String title, String message, String link) {
        try {
            Notification n = Notification.builder()
                    .userId(userId)
                    .type(type)
                    .title(title)
                    .message(message)
                    .link(link)
                    .build();
            notificationRepository.save(n);
        } catch (Exception e) {
            log.warn("Failed to persist notification for user {}: {}", userId, e.getMessage());
        }

        // Web Push — async, non-blocking, failures logged inside WebPushService
        webPushService.sendToUser(userId, title, message, link, null);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    // ── Mark read ─────────────────────────────────────────────────────────────

    @Transactional
    public NotificationResponse markRead(Long userId, Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Notification not found");
        }
        n.setRead(true);
        return toResponse(notificationRepository.save(n));
    }

    @Transactional
    public int markAllRead(Long userId) {
        return notificationRepository.markAllReadByUserId(userId);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .type(n.getType().name())
                .title(n.getTitle())
                .message(n.getMessage())
                .link(n.getLink())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
