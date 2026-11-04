package com.tiendaropa.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CheckoutRequest {

    /**
     * Client-generated idempotency key — one UUID per checkout *attempt*, kept
     * identical across retries (network timeout, double click, page reload).
     * The backend uses it to guarantee at most one order per attempt, even if
     * the request reaches the server multiple times. See CheckoutService.
     */
    @NotBlank
    @Size(min = 8, max = 64)
    private String idempotencyKey;

    @NotNull
    private Long cartId;

    @NotNull
    private Long shippingAddressId;

    /**
     * Payment method: MERCADOPAGO | TRANSFER | CASH
     */
    @NotBlank
    private String paymentMethod;

    /**
     * Number of installments (1–12). Only used when paymentMethod = MERCADOPAGO.
     * Defaults to 1 if not provided.
     */
    @Min(1) @Max(12)
    private Integer installments = 1;

    /** Optional coupon code to apply at checkout */
    private String couponCode;

    /** Optional gift card code to apply at checkout */
    private String giftCardCode;

    /**
     * ID de la tarifa de envío seleccionada por el usuario.
     * Si es null, el envío se considera incluido o gratuito (shippingAmount = 0).
     */
    private Long shippingRateId;

    /**
     * Number of loyalty points to redeem as a discount.
     * 100 points = $100 ARS (= 10_000 centavos). Must be a multiple of 100.
     * Zero or null means "don't redeem any points".
     */
    @Min(0)
    private Integer pointsToRedeem = 0;
}
