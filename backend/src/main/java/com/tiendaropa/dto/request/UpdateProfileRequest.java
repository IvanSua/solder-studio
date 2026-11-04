package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    @NotBlank(message = "El nombre es requerido")
    @Size(max = 100)
    private String firstName;

    @NotBlank(message = "El apellido es requerido")
    @Size(max = 100)
    private String lastName;

    @Size(max = 20)
    private String phone;

    /**
     * CUIT or DNI for invoicing (optional).
     * Accepts formats: 20-12345678-9 or 12345678 (DNI only).
     */
    @Pattern(regexp = "^(\\d{11}|\\d{2}-\\d{8}-\\d{1}|\\d{8})?$",
             message = "Formato de CUIT/DNI inválido")
    @Size(max = 13)
    private String cuit;
}
