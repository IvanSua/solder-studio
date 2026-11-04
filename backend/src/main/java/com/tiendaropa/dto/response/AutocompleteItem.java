package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutocompleteItem {
    private Long productId;
    private String name;
    private String slug;
    private String imageUrl;        // first/primary image URL, can be null
    private Long minPriceAmount;    // lowest variant price in centavos
    private String currencyCode;
}
