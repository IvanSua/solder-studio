package com.tiendaropa.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingRateRequest {

    private String province;
    private String postalCodePrefix;
    private String carrierName;
    private int deliveryDaysMin;
    private int deliveryDaysMax;
    private long priceAmount;
    private Long freeShippingThreshold;
}
