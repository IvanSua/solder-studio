package com.tiendaropa.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CustomDesignRequest {

    @NotNull
    private Long productVariantId;

    @Valid
    private List<AssetPlacement> assets;

    @Data
    public static class AssetPlacement {
        @NotNull
        private Long assetId;
        @NotNull
        private Double x;
        @NotNull
        private Double y;
        @NotNull
        private Double scaleX;
        @NotNull
        private Double scaleY;
        @NotNull
        private Double rotation;
        @NotNull
        private Integer zIndex;
    }

    /** Represents a user-typed text overlay in the customizer canvas. */
    @Data
    public static class TextLayer {
        @NotNull
        private String text;
        private String fontFamily;
        private Integer fontSize;
        private String fontStyle;   // e.g. "normal", "bold", "italic", "bold italic"
        private String fill;        // CSS hex color, e.g. "#1a1a1a"
        @NotNull
        private Double x;
        @NotNull
        private Double y;
        private Double scaleX;
        private Double scaleY;
        private Double rotation;
        @NotNull
        private Integer zIndex;
    }
}
