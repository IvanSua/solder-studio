package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Payload sent by the browser when subscribing to push notifications.
 * Maps directly to the PushSubscription Web API object.
 */
@Data
public class PushSubscriptionRequest {

    @NotBlank
    private String endpoint;

    /** DH public key from subscription.getKey('p256dh') — Base64url encoded */
    @NotBlank
    private String p256dh;

    /** Auth secret from subscription.getKey('auth') — Base64url encoded */
    @NotBlank
    private String auth;

    /** Optional: browser/OS user agent for display purposes */
    private String userAgent;
}
