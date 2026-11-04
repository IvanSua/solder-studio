package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AddressResponse {

    Long id;
    String street;
    String apartment;
    String city;
    String province;
    String postalCode;
    String notes;
    boolean defaultAddress;
}
