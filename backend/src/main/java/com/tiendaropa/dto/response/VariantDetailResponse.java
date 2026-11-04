package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Full variant context returned by GET /api/variants/{id}.
 * Carries everything the frontend customizer needs in a single call:
 * variant fields + parent product info + images + print area.
 */
@Data
@Builder
@AllArgsConstructor
public class VariantDetailResponse {

    // ── Variant fields ──────────────────────────────────────────────────────
    private Long variantId;
    private String color;
    private String size;
    private Long priceAmount;
    private String currencyCode;
    private int stockAvailable;
    private String sku;

    // ── Parent product fields ───────────────────────────────────────────────
    private Long productId;
    private String productName;
    private String productSlug;
    private boolean customizable;

    // ── Product images (used by the customizer as mockup background) ────────
    private List<ProductResponse.ImageResponse> images;

    // ── Print area (canvas constraints for the customizer) ──────────────────
    private ProductResponse.PrintAreaResponse printArea;
}
