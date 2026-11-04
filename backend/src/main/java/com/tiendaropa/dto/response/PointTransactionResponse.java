package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder
public class PointTransactionResponse {
    private Long id;
    private Integer amount;
    private String reason;
    private Long referenceId;
    private Instant createdAt;
}
