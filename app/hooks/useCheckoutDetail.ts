// src/hooks/useCheckoutDetail.ts

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useEffect } from 'react';
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from '~/lib/auth/apiClient';

/** ===== Shared value objects ===== */
export interface Amount {
  id: string;
  amount: string; // string as returned by backend (e.g., "1000")
  currency: string;
  createdAt?: string;
  updatedAt?: string;
  hibernateLazyInitializer?: Record<string, unknown>;
}

/** ===== Branding & Contacts (updated for categories) ===== */
export interface Brand {
  id: string;
  displayName: string;
  customerEmail: string;
  displayLogo: string;   // may be relative (e.g., "/api/files/uploads/...png")
  customerSupportPhone: string;
  coverPhoto: string;    // may be relative (e.g., "/api/files/uploads/...jpeg")
  /** New payload provides categories: [] (array). Keep legacy 'category' optional for BC. */
  categories?: string[];
  category?: string;     // legacy single category (optional now)
  returnPolicyUrl?: string;
  refundPolicyUrl?: string;
  shortDescription?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  qrCode?: string;       // base64-encoded PNG in sample
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  sendbirdAccessToken?: string | null;
  channelUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailContacts {
  id: string;
  createdAt: string;
  updatedAt: string;
  generalBusinessEmail?: string | null;
  financialServicesEmail?: string | null;
  pressAndMediaEmail?: string | null;
  marketingAndSalesEmail?: string | null;
  humanResourcesEmail?: string | null;
  technicalSupportEmail?: string | null;
  legalAndComplianceEmail?: string | null;
  partnershipsEmail?: string | null;
}

export interface SelfPayTier {
  termType: string;
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

export interface Address {
  id: string;
  branchNumber: string;
  locatedInMall: boolean;
  mallName?: string | null;
  businessAtHome: boolean;
  suiteNumber: string;
  streetAddress: string;
  zipCode: string;
  city: string;
  state: string;
  storeName: string;
  longitude: number;
  latitude: number;
  acquirerMerchantSchemeName: string;
  acquirerMerchantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Discount {
  id: string;
  createdAt: string;
  updatedAt: string;
  discountName: string;
  type: string;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  minimumPurchaseAmount?: number | null;
  singleUse: boolean;
  expiresAt?: string | null;
  expiredByMerchant: boolean;
  discountState: string;
}

export interface Offer {
  id: string;
  campaignName: string;
  offerAvailability: string;
  offerType: string;
  discountAmount: number;
  offerCopy: string;
  preferredUrl: string;
  offerStart: string;
  offerEnd: string;
  status: string;
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
  mcc: string;
  detailsSubmitted: boolean;
  sandboxSecretKey: string;
  avgOrderValue: string;
  integrationPlatform: string;
  annualRevenue: string;
  url: string;
  shippingTime: string;
  emailContacts: EmailContacts;
  configuration: Configuration;
  addresses: Address[];
  discounts: Discount[];
  offers: Offer[];
  users: User[];
  merchantType: string;
}

/** ===== Checkout detail shape (unchanged for the new sample) ===== */
export interface CheckoutDetail {
  id: string;
  version?: number;
  redirectCheckoutUrl: string | null;
  token: string;
  checkoutToken: string;
  reference: string | null;
  sandbox: boolean;
  checkoutDetails: unknown | null;
  state: string;             // e.g., "CREATED"
  checkoutType: string;      // e.g., "ONLINE"
  originalAmount: Amount;
  totalAmount: Amount;
  expires: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  postCompletionCaptureProcessedAt?: string | null;
  discounts: Discount[];
}

/** ===== Response wrapper (UPDATED: merchantBaseId present; keep old fields for BC) ===== */
export interface CheckoutDetailResponse {
  checkout: CheckoutDetail;
  /** New key from sample */
  merchantBaseId: string | null;
  /** Keep legacy/optional fields for older responses */
  configuration?: Configuration | null;
  merchant?: Merchant | null;
  /** Brand is present in the new sample */
  brand: Brand | null;
  discounts: Discount[];
  /** Optional legacy id if some environments still return it */
  merchantId?: string | null;
}

/** ===== Networking (using authFetch) ===== */
async function fetchCheckoutDetail(
  checkoutToken: string
): Promise<CheckoutDetailResponse> {
  // Centralized authFetch handles base URL, token, and AuthError on 401
  return authFetch<CheckoutDetailResponse>(
    `/api/checkout/details-by-token/${checkoutToken}`
  );
}

/** ===== React Query Hook (Authenticated Query with redirect on 401) ===== */
export function useCheckoutDetail(checkoutToken: string) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<CheckoutDetailResponse, Error>({
    // FIXED: Removed token from query key (anti-pattern)
    // Checkout is identified by its token only
    queryKey: ["checkout", "detail", checkoutToken],
    queryFn: () => fetchCheckoutDetail(checkoutToken),
    enabled: !!checkoutToken && !!token && isBrowser,
    // Shorter stale time for checkout data (2 minutes)
    staleTime: 1000 * 60 * 2,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate('/login', { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
