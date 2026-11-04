package com.tiendaropa.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductFilterRequest {
    private String query;
    private Long categoryId;
    private Long priceMin;
    private Long priceMax;
    private List<String> sizes;
    private List<String> colors;
    private boolean inStockOnly;
}
