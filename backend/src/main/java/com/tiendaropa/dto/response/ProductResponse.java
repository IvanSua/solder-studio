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
public class ProductResponse {
    private Long id;
    private String name;
    private String slug;
    private String description;
    private Long categoryId;
    private String categoryName;
    private boolean customizable;
    private boolean active;
    private List<VariantResponse> variants;
    private List<ImageResponse> images;
    private PrintAreaResponse printArea;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VariantResponse {
        private Long id;
        private String color;
        private String size;
        private Long priceAmount;
        private String currencyCode;
        private int stockAvailable;
        private int stockTotal;
        private int stockReserved;
        private String sku;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageResponse {
        private Long id;
        private String imageUrl;
        private String altText;
        private boolean primary;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PrintAreaResponse {
        private Integer canvasWidth;
        private Integer canvasHeight;
        private Integer printableX;
        private Integer printableY;
        private Integer printableWidth;
        private Integer printableHeight;
    }
}
