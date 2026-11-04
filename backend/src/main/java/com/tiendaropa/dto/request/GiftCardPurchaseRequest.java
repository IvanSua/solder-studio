package com.tiendaropa.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GiftCardPurchaseRequest {

    /** One UUID per purchase attempt — see CheckoutRequest.idempotencyKey for the rationale. */
    @NotBlank(message = "idempotencyKey es requerido")
    @Size(min = 8, max = 64)
    private String idempotencyKey;

    @NotNull(message = "El monto es requerido")
    @DecimalMin(value = "100.00", message = "El monto mínimo es $100 ARS")
    @DecimalMax(value = "50000.00", message = "El monto máximo es $50.000 ARS")
    private BigDecimal amount;

    private String recipientEmail;
    
    private String recipientName;
    
    private String message;
}
