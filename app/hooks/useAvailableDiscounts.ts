// File: src/hooks/useAvailableDiscounts.ts

import { useQuery } from '@tanstack/react-query';

/** ===== Types ===== */
export interface Discount {
  id: string;
  createdAt: string;
  updatedAt: string;
  merchant: any;
  discountName: string;
  type: 'PERCENTAGE_OFF' | 'AMOUNT_OFF';
  discountPercentage?: number | null;
  discountAmount?: number | null;
  minimumPurchaseAmount?: number | null;
  singleUse: boolean;
  expiresAt?: string | null;
  redeemedBy: string[];
  applicableUsers: string[];
  checkout: any | null;
  expiredByMerchant: boolean;
}

/** ===== Networking (token passed in, like your web version) ===== */
async function fetchAvailableDiscounts(
  merchantId: string,
  orderAmount: number,
  accessToken: string
): Promise<Discount[]> {
  const url = `http://localhost:8080/api/discounts/available/merchant?merchantId=${encodeURIComponent(
    merchantId
  )}&orderAmount=${encodeURIComponent(String(orderAmount))}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Error fetching discounts: ${res.status} ${res.statusText} – ${text}`
    );
    }

  return (await res.json()) as Discount[];
}

/** ===== React Query Hook (reads token from sessionStorage) ===== */
export function useAvailableDiscounts(merchantId: string, orderAmount: number) {
  const accessToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('accessToken')
      : null;

  return useQuery<Discount[], Error>({
    queryKey: ['availableDiscounts', merchantId, orderAmount],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No access token available');
      }
      return fetchAvailableDiscounts(merchantId, orderAmount, accessToken);
    },
    enabled: !!merchantId && orderAmount > 0 && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
