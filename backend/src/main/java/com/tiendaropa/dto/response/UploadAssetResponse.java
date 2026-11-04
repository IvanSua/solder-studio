package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Returned by POST /api/custom-designs/{id}/assets.
 * Carries the real database ID of the saved asset so the
 * frontend can reference it correctly when submitting placements.
 */
@Data
@Builder
@AllArgsConstructor
public class UploadAssetResponse {
    /** Database ID of the persisted DesignAsset. */
    private Long assetId;
    /**
     * Zero-based position of this asset within the design.
     * Matches the sort_order column in the DB.
     */
    private int sortOrder;
}
