export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  customizable: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  printArea: PrintArea | null;
}

export interface ProductVariant {
  id: number;
  color: string;
  size: string;
  priceAmount: number;
  currencyCode: string;
  stockAvailable: number;
  sku: string;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  altText: string;
  primary: boolean;
}

export interface PrintArea {
  canvasWidth: number;
  canvasHeight: number;
  printableX: number;
  printableY: number;
  printableWidth: number;
  printableHeight: number;
}

export interface ProductPage {
  content: Product[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Full variant context returned by GET /api/products/variants/:id.
 * Used exclusively by the customizer to get product info + print area
 * from a single call, without needing to know the productId in advance.
 */
export interface VariantDetail {
  variantId: number;
  color: string;
  size: string;
  priceAmount: number;
  currencyCode: string;
  stockAvailable: number;
  sku: string;
  productId: number;
  productName: string;
  productSlug: string;
  customizable: boolean;
  images: ProductImage[];
  printArea: PrintArea | null;
}
