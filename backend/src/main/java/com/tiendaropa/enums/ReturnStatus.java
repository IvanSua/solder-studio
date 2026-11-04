package com.tiendaropa.enums;

public enum ReturnStatus {
    /** Customer submitted the request — awaiting admin review */
    PENDING,
    /** Admin approved; awaiting product to be shipped back */
    APPROVED,
    /** Product received by warehouse; refund/exchange being processed */
    IN_PROGRESS,
    /** Refund issued or exchange shipped */
    COMPLETED,
    /** Admin rejected the request */
    REJECTED
}
