// src/hooks/useMerchantDetail.ts
import { useQuery } from '@tanstack/react-query';

// Define interfaces for Merchant Details

export interface MerchantAddress {
  addressId: string;
  zipCode: string;
  streetAddress: string;
  city: string;
  state: string;
  storeName: string;
  latitude: number;
  longitude: number;
}

export interface MerchantOffer {
  offerId: string;
  offerType: string;
  offerAvailability: 'ONLINE' | 'IN_STORE' | 'ONLINE_AND_IN_STORE';
  campaignName: string;
  status: string;
  offerEnd?: string;
  preferredUrl?: string;
  addresses: MerchantAddress[];
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

export interface MerchantDetail {
  merchantId: string;
  brand: MerchantBrand;
  addresses: MerchantAddress[];
  offers?: MerchantOffer[];
  url?: string;
}

export interface MerchantDetailResponse {
  success: boolean;
  data: MerchantDetail | null;
  error: string | null;
}

// Fetch merchant details by ID
async function fetchMerchantDetail(merchantId: string, token: string): Promise<MerchantDetailResponse> {
  const response = await fetch(`http://192.168.1.32:8080/api/merchant/${merchantId}/details`, {
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

  const data: MerchantDetailResponse = await response.json();
  return data;
}

// Custom hook to fetch merchant detail using useQuery
export function useMerchantDetail(merchantId: string) {
  // Retrieve the access token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<MerchantDetailResponse, Error>({
    queryKey: ['merchantDetail', merchantId],
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchMerchantDetail(merchantId, token);
    },
    enabled: !!merchantId && !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
