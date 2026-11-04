export interface CustomDesign {
  designId: number;
  status: string;
  previewUrl: string | null;
  productionRenderUrl: string | null;
  // Variant
  variantId: number | null;
  variantColor: string | null;
  variantSize: string | null;
  // Product
  productId: number | null;
  productName: string | null;
  productSlug: string | null;
  productImageUrl: string | null;
  // Timestamps
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CustomDesignRequest {
  productVariantId: number;
  assets: AssetPlacement[];
}

export interface AssetPlacement {
  assetId: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  zIndex: number;
}

/** Returned by POST /api/custom-designs/{id}/assets */
export interface UploadAssetResponse {
  /** Real database ID of the saved asset. Use this as assetId in AssetPlacement. */
  assetId: number;
  /** Zero-based position within the design. */
  sortOrder: number;
}

/** Text overlay placed on the canvas by the user. */
export interface TextLayerPlacement {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;   // 'normal' | 'bold' | 'italic' | 'bold italic'
  fill: string;        // hex color e.g. '#1a1a1a'
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  zIndex: number;
}

/** Body sent to PATCH /api/custom-designs/{id}/scene */
export interface UpdateSceneRequest {
  assets: AssetPlacement[];
  textLayers: TextLayerPlacement[];
}
