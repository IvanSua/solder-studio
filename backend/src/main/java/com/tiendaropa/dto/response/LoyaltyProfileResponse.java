package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class LoyaltyProfileResponse {
    private Integer points;
    private String level;          // BRONZE / SILVER / GOLD / PLATINUM
    private String levelLabel;     // Bronce / Plata / Oro / Platino
    private Integer nextLevelPoints;   // points to reach next level (0 if already max)
    private Integer pointsToNextLevel; // how many more needed
    private double levelProgress;      // 0.0–1.0 (progress within current level)
    private String referralCode;
    private Integer referralCount;     // how many users signed up with this code
    private List<SavedSizeResponse> savedSizes;
}
