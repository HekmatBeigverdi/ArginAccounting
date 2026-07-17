export type AddressOwnerType =
  | "company"
  | "branch";

export type AddressType =
  | "registered"
  | "operational"
  | "postal"
  | "other";

export interface Address {
  id: string;
  ownerType: AddressOwnerType;
  ownerId: string;
  addressType: AddressType;
  province: string | null;
  city: string | null;
  addressLine: string;
  postalCode: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  ownerType: AddressOwnerType;
  ownerId: string;
  addressType: AddressType;
  province?: string | null;
  city?: string | null;
  addressLine: string;
  postalCode?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}
