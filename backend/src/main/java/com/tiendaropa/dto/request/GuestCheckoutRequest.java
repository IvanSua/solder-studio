package com.tiendaropa.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Checkout sin cuenta. Internamente crea (o reutiliza) un usuario "guest" —
 * mismo mecanismo que ya usan los usuarios de OAuth2 (passwordHash vacío, ver
 * CustomOAuth2UserService) — y delega en el mismo CheckoutService que usa el
 * flujo autenticado. Ver GuestCheckoutService.
 */
@Data
public class GuestCheckoutRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    private String phone;

    // ── Dirección de envío (el invitado no tiene direcciones guardadas) ────────
    @NotBlank
    private String street;

    private String apartment;

    @NotBlank
    private String city;

    @NotBlank
    private String province;

    @NotBlank
    private String postalCode;

    // ── Carrito (el invitado no tiene un carrito persistente propio) ───────────
    @NotEmpty
    @Valid
    private List<CartItemRequest> items;

    // ── Mismos campos que CheckoutRequest ───────────────────────────────────────
    @NotBlank
    @Size(min = 8, max = 64)
    private String idempotencyKey;

    @NotBlank
    private String paymentMethod;

    @Min(1) @Max(12)
    private Integer installments = 1;

    private String couponCode;

    private String giftCardCode;

    private Long shippingRateId;
}
