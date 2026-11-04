package com.tiendaropa.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateVariantRequest {

    @NotBlank
    private String color;

    @NotBlank
    private String size;

    /** Price in centavos (ARS minimum unit) */
    @NotNull
    @Min(1)
    private Long priceAmount;

    @Min(0)
    private int stockTotal = 0;

    private String sku;
}
