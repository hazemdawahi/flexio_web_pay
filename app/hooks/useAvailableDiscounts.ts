// File: src/hooks/useAvailableDiscounts.ts

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useEffect } from 'react';
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from '~/lib/auth/apiClient';

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

/** ===== React Query Hook (authenticated query with redirect on 401) ===== */
export function useAvailableDiscounts(merchantId: string, orderAmount: number) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<Discount[], Error>({
    // FIXED: Removed token from query key (anti-pattern)
    // Discounts are keyed by merchant and amount
    queryKey: ["discounts", "available", { merchantId, orderAmount }],
    queryFn: () =>
      authFetch<Discount[]>(
        `/api/discounts/available/merchant?merchantId=${encodeURIComponent(
          merchantId
        )}&orderAmount=${encodeURIComponent(String(orderAmount))}`
      ),
    enabled: !!token && !!merchantId && orderAmount > 0 && isBrowser,
    staleTime: 1000 * 60 * 2, // 2 minutes for discounts
    retry: false,
    // Keep previous discounts while loading new ones
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate('/login', { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
