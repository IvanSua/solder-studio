package com.tiendaropa.enums;

public enum CarrierMode {
    /** Use the manual DB rates table (shipping_rates) for this carrier. */
    MANUAL,
    /** Call the carrier's API in real time. Falls back to MANUAL if credentials are missing. */
    AUTO
}
