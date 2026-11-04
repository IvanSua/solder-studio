package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long expiresIn;
    private UserResponse user;

    /**
     * Set to {@code true} when the user has 2FA enabled.
     * In this case {@code accessToken} is null and {@code tempToken} is provided.
     * The client must call POST /api/auth/2fa/verify to complete login.
     */
    private boolean requiresTwoFactor;

    /**
     * Short-lived (5 min) token used as the input to the 2FA verify endpoint.
     * Only present when {@code requiresTwoFactor = true}.
     */
    private String tempToken;
}
