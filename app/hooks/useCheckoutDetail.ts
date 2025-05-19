// src/hooks/useCheckoutDetail.ts

import { useQuery } from '@tanstack/react-query';

export interface Amount {
  id: string;
  amount: string; // e.g. "1000.00"
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
  returnPolicyUrl?: string;
  refundPolicyUrl?: string;
  shortDescription?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  qrCode?: string;
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

export interface CheckoutDetail {
  id: string;
  redirectCheckoutUrl: string | null;
  token: string;
  checkoutToken: string;
  reference: string | null;
  sandbox: boolean;
  checkoutDetails: unknown | null;
  state: string;
  paymentSchemes: unknown[];
  totalAmount: Amount;
  merchant: Merchant;
  expires: string | null;
  createdAt: string;
  updatedAt: string;
  user: unknown | null;
  checkoutEvents: unknown[];
  checkoutType: string;
  discounts: unknown[];
  capturedRecords: unknown[];
  refundRecords: unknown[];
}

export interface CheckoutDetailResponse {
  checkout: CheckoutDetail;
  configuration: Configuration;
  brand: Brand | null;
  serviceBrand: Brand | null;
}

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
    throw new Error(
      `Error fetching checkout detail: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as CheckoutDetailResponse;
}

export function useCheckoutDetail(checkoutToken: string) {
  const accessToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('accessToken')
      : null;

  return useQuery<CheckoutDetailResponse, Error>({
    queryKey: ['checkoutDetail', checkoutToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No access token available');
      }
      return fetchCheckoutDetail(checkoutToken, accessToken);
    },
    enabled: !!checkoutToken && !!accessToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
