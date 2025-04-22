// src/hooks/useCheckoutDetail.ts

import { useQuery } from '@tanstack/react-query';

export interface Amount {
  id: string;
  amount: string; // The API returns the amount as a string (e.g., "10000" or "1000.00")
  currency: string;
  hibernateLazyInitializer?: Record<string, unknown>;
}

export interface Brand {
  id: string;
  displayName: string;
  customerEmail: string;
  displayLogo: string;
  customerSupportPhone: string;
  coverPhoto: string;
  category: string;
  // Merchant‐brand specific URLs (may be absent on a service brand)
  returnPolicyUrl?: string;
  refundPolicyUrl?: string;
  // Service‐brand specific fields (may be absent on a merchant brand)
  shortDescription?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Merchant {
  id: string;
  createdAt: string;
  updatedAt: string;
  stripeRequirements: boolean;
  verified: boolean;
  accountId: string;
  mid: string;
  mcc: string | null;
  name: string | null;
  industry: string | null;
  detailsSubmitted: boolean;
  requirementDeadline: string | null;
  verifiedDate: string | null;
  // A merchant may have either a merchant‐brand or a service‐brand (or neither)
  brand?: Brand | null;
  serviceBrand?: Brand | null;
  hibernateLazyInitializer?: Record<string, unknown>;
}

export interface CheckoutDetail {
  id: string;
  redirectCheckoutUrl: string | null;
  token: string;
  checkoutToken?: string; // Optional, as present in the API response
  reference: string | null;
  sandbox: boolean;
  state: string;
  totalAmount: Amount;
  merchant: Merchant;
  expires: string | null;
  createdAt: string;
  updatedAt: string;
  user: any; // Adjust this type as needed if user data becomes available
  checkoutType: string;
  discounts: any[]; // Matches the "discounts" array in the API response
}

// New interfaces for Configuration details
export interface SelfPayTier {
  minAmount: string;
  maxAmount: string;
  minTerm: number;
  maxTerm: number;
}

export interface Configuration {
  id: string;
  maxAmount: Amount;
  minAmount: Amount;
  checkout: string;
  checkoutUrl: string;
  enableSplitPay: boolean;
  splitPay: string;
  splitPayUrl: string;
  authorizationWebhookUrl: string;
  enableSelfPay: boolean;
  selfPayTiers: SelfPayTier[];
}

// Updated response interface returning checkout, configuration, and top‐level brand/serviceBrand
export interface CheckoutDetailResponse {
  checkout: CheckoutDetail;
  configuration: Configuration;
  brand: Brand | null;
  serviceBrand: Brand | null;
}

// Fetch checkout details by token (using the token in the URL)
async function fetchCheckoutDetail(
  checkoutToken: string,
  accessToken: string
): Promise<CheckoutDetailResponse> {
  const response = await fetch(
    `http://192.168.1.32:8080/api/checkout/details-by-token/${checkoutToken}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: CheckoutDetailResponse = await response.json();
  return data;
}

// Custom hook to fetch checkout detail using useQuery
export function useCheckoutDetail(checkoutToken: string) {
  // Retrieve the access token from sessionStorage
  const accessToken =
    typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<CheckoutDetailResponse, Error>({
    queryKey: ['checkoutDetail', checkoutToken],
    queryFn: () => {
      if (!accessToken) throw new Error('No access token available');
      return fetchCheckoutDetail(checkoutToken, accessToken);
    },
    enabled: !!checkoutToken && !!accessToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
