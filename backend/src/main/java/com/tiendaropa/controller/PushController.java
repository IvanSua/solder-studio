package com.tiendaropa.controller;

import com.tiendaropa.dto.request.PushSubscriptionRequest;
import com.tiendaropa.service.WebPushService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService webPushService;

    /**
     * Returns the VAPID public key so the frontend can subscribe.
     * This endpoint is public — no auth required.
     */
    @GetMapping("/vapid-public-key")
    public Map<String, String> vapidPublicKey() {
        return Map.of("publicKey", webPushService.getVapidPublicKey());
    }

    /**
     * Registers a new push subscription for the authenticated user.
     */
    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> subscribe(
            Authentication auth,
            @Valid @RequestBody PushSubscriptionRequest request,
            HttpServletRequest httpRequest) {

        // Attach user-agent for informational purposes
        if (request.getUserAgent() == null) {
            request.setUserAgent(httpRequest.getHeader("User-Agent"));
        }
        webPushService.subscribe(userId(auth), request);
        return Map.of("status", "subscribed");
    }

    /**
     * Removes a subscription by endpoint (called on browser unsubscribe).
     */
    @DeleteMapping("/unsubscribe")
    public Map<String, String> unsubscribe(
            @RequestBody Map<String, String> body) {
        String endpoint = body.get("endpoint");
        if (endpoint != null) {
            webPushService.unsubscribe(endpoint);
        }
        return Map.of("status", "unsubscribed");
    }

    /**
     * Removes ALL subscriptions for the authenticated user
     * (e.g. on logout or account deletion).
     */
    @DeleteMapping("/unsubscribe-all")
    public Map<String, String> unsubscribeAll(Authentication auth) {
        webPushService.unsubscribeAll(userId(auth));
        return Map.of("status", "all_unsubscribed");
    }

    private Long userId(Authentication auth) {
        return (Long) auth.getPrincipal();
    }
}
