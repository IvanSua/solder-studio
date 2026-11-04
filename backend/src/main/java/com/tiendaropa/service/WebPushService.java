package com.tiendaropa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.dto.request.PushSubscriptionRequest;
import com.tiendaropa.entity.PushSubscription;
import com.tiendaropa.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Handles Web Push subscriptions and delivers push notifications via VAPID.
 *
 * <p>VAPID keys must be generated once and stored as environment variables.
 * Generate them with this one-liner (Node.js):
 * <pre>
 *   node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2));"
 * </pre>
 * Or via the /api/v1/push/vapid-public-key endpoint on first startup (dev only).
 *
 * <p>Required env vars:
 * <ul>
 *   <li>{@code PUSH_VAPID_PUBLIC_KEY}  — Base64url-encoded VAPID public key</li>
 *   <li>{@code PUSH_VAPID_PRIVATE_KEY} — Base64url-encoded VAPID private key</li>
 *   <li>{@code PUSH_VAPID_SUBJECT}     — mailto: or https: identifier</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private final PushSubscriptionRepository subscriptionRepo;
    private final ObjectMapper objectMapper;

    @Value("${push.vapid.public-key:}")
    private String vapidPublicKey;

    @Value("${push.vapid.private-key:}")
    private String vapidPrivateKey;

    @Value("${push.vapid.subject:mailto:noreply@solderstudio.com.ar}")
    private String vapidSubject;

    private PushService pushService;
    private boolean enabled = false;

    @PostConstruct
    void init() {
        Security.addProvider(new BouncyCastleProvider());
        if (vapidPublicKey.isBlank() || vapidPrivateKey.isBlank()) {
            log.warn("PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY not set — web push disabled");
            return;
        }
        try {
            pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
            enabled = true;
            log.info("Web Push service initialized (VAPID subject: {})", vapidSubject);
        } catch (Exception e) {
            log.error("Failed to initialize Web Push service: {}", e.getMessage(), e);
        }
    }

    // ── Public key ────────────────────────────────────────────────────────────

    public String getVapidPublicKey() {
        return vapidPublicKey;
    }

    // ── Subscription management ───────────────────────────────────────────────

    @Transactional
    public void subscribe(Long userId, PushSubscriptionRequest req) {
        subscriptionRepo.findByEndpoint(req.getEndpoint()).ifPresentOrElse(
                existing -> {
                    // Update auth/key in case they rotated
                    existing.setP256dh(req.getP256dh());
                    existing.setAuth(req.getAuth());
                    existing.setLastUsedAt(Instant.now());
                    subscriptionRepo.save(existing);
                },
                () -> subscriptionRepo.save(PushSubscription.builder()
                        .userId(userId)
                        .endpoint(req.getEndpoint())
                        .p256dh(req.getP256dh())
                        .auth(req.getAuth())
                        .userAgent(req.getUserAgent())
                        .build())
        );
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        subscriptionRepo.deleteByEndpoint(endpoint);
    }

    @Transactional
    public void unsubscribeAll(Long userId) {
        subscriptionRepo.deleteAllByUserId(userId);
    }

    // ── Sending ───────────────────────────────────────────────────────────────

    /**
     * Sends a push notification to ALL subscriptions of a user.
     * Fire-and-forget: runs async, logs failures, never throws.
     *
     * @param userId  target user
     * @param title   notification title
     * @param body    notification body text
     * @param url     deep-link URL (e.g. /orders/42) — can be null
     * @param icon    icon path (e.g. /assets/icons/icon-192x192.png) — can be null
     */
    @Async
    public void sendToUser(Long userId, String title, String body, String url, String icon) {
        if (!enabled) return;

        List<PushSubscription> subs = subscriptionRepo.findByUserId(userId);
        if (subs.isEmpty()) return;

        Map<String, Object> payload = buildPayload(title, body, url, icon);
        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Failed to serialize push payload: {}", e.getMessage());
            return;
        }

        for (PushSubscription sub : subs) {
            sendOne(sub, payloadJson);
        }
    }

    private void sendOne(PushSubscription sub, String payloadJson) {
        try {
            Notification notification = new Notification(
                    sub.getEndpoint(),
                    sub.getP256dh(),
                    sub.getAuth(),
                    payloadJson.getBytes()
            );
            org.apache.http.HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();

            if (status == 410 || status == 404) {
                // Subscription expired — clean up
                log.info("Push subscription gone ({}), removing endpoint: {}",
                        status, sub.getEndpoint().substring(0, Math.min(50, sub.getEndpoint().length())));
                subscriptionRepo.deleteByEndpoint(sub.getEndpoint());
            } else if (status >= 400) {
                log.warn("Push delivery failed with status {} for user {}", status, sub.getUserId());
            }
        } catch (Exception e) {
            log.warn("Failed to send push to user {}: {}", sub.getUserId(), e.getMessage());
        }
    }

    private Map<String, Object> buildPayload(String title, String body, String url, String icon) {
        return Map.of(
                "title",   title,
                "body",    body != null ? body : "",
                "url",     url   != null ? url   : "/",
                "icon",    icon  != null ? icon  : "/assets/icons/icon-192x192.png",
                "badge",   "/assets/icons/icon-72x72.png",
                "timestamp", Instant.now().toEpochMilli()
        );
    }
}
