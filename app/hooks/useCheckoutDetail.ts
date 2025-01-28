// src/hooks/useCheckoutDetail.ts
import { useQuery } from '@tanstack/react-query';

// Define interfaces for Checkout Details

export interface Consumer {
  id: string;
  email: string;
  givenNames: string;
  surname: string;
  phoneNumber: string;
}

export interface Address {
  id: string;
  name: string;
  line1: string;
  line2: string;
  area1: string;
  area2: string;
  region: string;
  postcode: string;
  countryCode: string;
  phoneNumber: string;
}

export interface Courier {
  id: string;
  shippedAt: string;
  name: string;
  tracking: string;
  priority: string;
}

export interface Amount {
  id: string;
  amount: number;
  currency: string;
}

export interface ItemPrice {
  id: string;
  amount: number;
  currency: string;
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  pageUrl: string;
  imageUrl: string;
  price: ItemPrice;
  categories: string[];
  estimatedShipmentDate: string;
}

export interface DiscountAmount {
  id: string;
  amount: number;
  currency: string;
}

export interface Discount {
  id: string;
  displayName: string;
  amount: DiscountAmount;
  description: string;
}

export interface MerchantBrand {
  id: string;
  displayName: string | null;
  customerEmail: string | null;
  displayLogo: string | null;
  customerSupportPhone: string | null;
  coverPhoto: string | null;
  category: string | null;
  returnPolicyUrl: string | null;
  refundPolicyUrl: string | null;
  createdAt: string;
  updatedAt: string;
  maxAmount: number | null;
  minAmount: number | null;
}

export interface Merchant {
  id: string;
  createdAt: string;
  updatedAt: string;
  stripeRequirements: boolean;
  verified: boolean;
  accountId: string;
  secretKey: string;
  mid: string;
  googleId: string | null;
  mcc: string;
  name: string | null;
  url: string;
  avgOrderValue: string;
  integrationPlatform: string;
  annualRevenue: string;
  industry: string | null;
  detailsSubmitted: boolean;
  requirementDeadline: string | null;
  verifiedDate: string | null;
  brand: MerchantBrand;
  addresses: any[]; // Adjust the type if addresses have a specific structure
  hibernateLazyInitializer: Record<string, unknown>;
}

export interface CheckoutDetail {
  id: string;
  consumer: Consumer;
  billing: Address;
  shipping: Address;
  courier: Courier;
  shippingAmount: Amount;
  taxAmount: Amount;
  items: Item[];
  discounts: Discount[];
  description: string;
  token: string;
  tokenExpires: string;
  redirectCheckoutUrl: string;
  merchant: Merchant;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutDetailResponse {
  success: boolean;
  data: CheckoutDetail | null;
  error: string | null;
}

// Fetch checkout details by ID
async function fetchCheckoutDetail(checkoutId: string, token: string): Promise<CheckoutDetailResponse> {
  const response = await fetch(`http://192.168.1.32:8080/api/checkouts/${checkoutId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: CheckoutDetailResponse = await response.json();
  return data;
}

// Custom hook to fetch checkout detail using useQuery
export function useCheckoutDetail(checkoutId: string) {
  // Retrieve the access token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<CheckoutDetailResponse, Error>({
    queryKey: ['checkoutDetail', checkoutId],
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchCheckoutDetail(checkoutId, token);
    },
    enabled: !!checkoutId && !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
