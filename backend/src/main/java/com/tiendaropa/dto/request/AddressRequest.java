package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddressRequest {

    @NotBlank
    private String street;

    private String apartment;

    @NotBlank
    private String city;

    @NotBlank
    private String province;

    @NotBlank
    private String postalCode;

    private String notes;

    private boolean defaultAddress;
}
