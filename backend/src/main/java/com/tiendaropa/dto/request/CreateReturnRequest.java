package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateReturnRequest {

    @NotNull
    private Long orderId;

    /**
     * Reason code: DEFECTIVE | WRONG_SIZE | WRONG_ITEM | CHANGED_MIND | OTHER
     */
    @NotBlank
    @Size(max = 30)
    private String reason;

    /** Optional free-text description (max 1 000 chars) */
    @Size(max = 1000)
    private String description;

    /**
     * Desired resolution: REFUND | EXCHANGE
     */
    @NotBlank
    @Size(max = 20)
    private String resolution = "REFUND";
}
