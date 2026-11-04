package com.tiendaropa.dto.response;

import com.tiendaropa.entity.ReturnRequest;
import lombok.Data;

import java.time.Instant;

@Data
public class ReturnRequestResponse {

    private Long    id;
    private Long    orderId;
    private String  reason;
    private String  description;
    private String  resolution;
    private String  status;
    private String  adminNotes;
    private Long    refundAmount;
    private Boolean refundProcessed;
    private Instant createdAt;
    private Instant updatedAt;

    public static ReturnRequestResponse from(ReturnRequest r) {
        ReturnRequestResponse dto = new ReturnRequestResponse();
        dto.setId(r.getId());
        dto.setOrderId(r.getOrder().getId());
        dto.setReason(r.getReason());
        dto.setDescription(r.getDescription());
        dto.setResolution(r.getResolution());
        dto.setStatus(r.getStatus().name());
        // Admin notes, refund details NOT exposed to customers
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }

    /** Admin-facing variant that also exposes admin notes and refund details */
    public static ReturnRequestResponse fromAdmin(ReturnRequest r) {
        ReturnRequestResponse dto = from(r);
        dto.setAdminNotes(r.getAdminNotes());
        dto.setRefundAmount(r.getRefundAmount());
        dto.setRefundProcessed(r.getRefundProcessed());
        return dto;
    }
}
