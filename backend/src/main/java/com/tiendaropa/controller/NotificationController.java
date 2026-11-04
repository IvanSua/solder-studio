package com.tiendaropa.controller;

import com.tiendaropa.dto.response.NotificationResponse;
import com.tiendaropa.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** Paginated notification list (most recent first). */
    @GetMapping
    public Page<NotificationResponse> list(
            Authentication auth,
            @PageableDefault(size = 20) Pageable pageable) {
        return notificationService.getNotifications(userId(auth), pageable);
    }

    /** Number of unread notifications — used for the navbar badge. */
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(Authentication auth) {
        return Map.of("count", notificationService.countUnread(userId(auth)));
    }

    /** Mark a single notification as read. */
    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(
            Authentication auth,
            @PathVariable Long id) {
        return notificationService.markRead(userId(auth), id);
    }

    /** Mark all notifications as read. */
    @PostMapping("/read-all")
    public Map<String, Integer> markAllRead(Authentication auth) {
        int updated = notificationService.markAllRead(userId(auth));
        return Map.of("updated", updated);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private Long userId(Authentication auth) {
        return (Long) auth.getPrincipal();
    }
}
