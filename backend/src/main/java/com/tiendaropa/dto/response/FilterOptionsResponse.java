package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FilterOptionsResponse {
    private List<String> sizes;
    private List<String> colors;
    private Long minPrice;
    private Long maxPrice;
}
