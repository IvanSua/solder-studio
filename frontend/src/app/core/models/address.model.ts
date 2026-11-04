export interface Address {
  id: number;
  street: string;
  apartment: string | null;
  city: string;
  province: string;
  postalCode: string;
  notes: string | null;
  defaultAddress: boolean;
}

export interface AddressRequest {
  street: string;
  apartment?: string;
  city: string;
  province: string;
  postalCode: string;
  notes?: string;
  defaultAddress: boolean;
}
