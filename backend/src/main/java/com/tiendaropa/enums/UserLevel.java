package com.tiendaropa.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum UserLevel {
    BRONZE  ("Bronce",   0,    500,  0),
    SILVER  ("Plata",  500,   2000,  0),
    GOLD    ("Oro",   2000,   5000,  5),
    PLATINUM("Platino", 5000, Integer.MAX_VALUE, 10);

    private final String label;
    private final int minPoints;
    private final int nextLevelPoints;  // MAX_VALUE if already at top
    /** Automatic checkout discount percentage for this tier (0, 5 or 10). */
    private final int discountPercent;
}
