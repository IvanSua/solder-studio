export interface Cart {
  cartId: number;
  items: CartItem[];
  totalAmount: number;
  currencyCode: string;
}

export interface CartItem {
  cartItemId: number;
  productVariantId: number;
  productName: string;
  productSlug: string | null;
  imageUrl: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  currencyCode: string;
  customDesignId: number | null;
}

export interface CartItemRequest {
  productVariantId: number;
  quantity: number;
  customDesignId?: number;
}
