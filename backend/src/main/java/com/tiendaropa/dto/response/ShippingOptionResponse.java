package com.tiendaropa.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingOptionResponse {

    private Long id;
    private String carrierName;
    private int deliveryDaysMin;
    private int deliveryDaysMax;
    private long priceAmount;
    private boolean isFree;
}
