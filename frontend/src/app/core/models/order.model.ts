export interface Order {
  orderId: number;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  items: OrderItem[];
  amounts: OrderAmounts;
  shippingAddress: ShippingAddress | null;
  paymentMethod: string | null;
  installments: number;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  street: string;
  apartment: string | null;
  city: string;
  province: string;
  postalCode: string;
}

export interface OrderItem {
  productVariantId: number;
  productName: string;
  productSlug: string | null;
  imageUrl: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  customDesignId: number | null;
}

export interface OrderAmounts {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
}

export interface CheckoutRequest {
  /**
   * One UUID per checkout *attempt*, generated client-side and kept identical
   * across retries (network timeout, double click, page reload). The backend
   * uses it to guarantee at most one order is created per attempt — see
   * CheckoutComponent.getOrCreateIdempotencyKey().
   */
  idempotencyKey: string;
  cartId: number;
  shippingAddressId: number;
  paymentMethod: string;
  installments?: number;
  couponCode?: string;
  giftCardCode?: string;
  shippingRateId?: number;
  /** Loyalty points to redeem as discount. 100 pts = $100 ARS. */
  pointsToRedeem?: number;
}

export interface LoyaltyCheckoutPreview {
  availablePoints: number;
  level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  levelLabel: string;
  tierDiscountPercent: number;
  tierDiscountAmount: number;
  maxRedeemablePoints: number;
  pointsDiscountAmount: number;
  pointsRedeemed: number;
}

export interface CheckoutResponse {
  orderId: number;
  reservationExpiresAt: string;
  paymentSession: {
    provider: string;
    checkoutUrl: string | null;
  };
  amounts: OrderAmounts & {
    giftCardDiscount?: number;
    tierDiscount?: number;
    tierDiscountPercent?: number;
    pointsDiscount?: number;
    pointsRedeemed?: number;
  };
  couponApplied: string | null;
  giftCardApplied: string | null;
  giftCardDiscount: number;
  loyaltyTierApplied: string | null;
  loyaltyPointsRedeemed: number;
}
