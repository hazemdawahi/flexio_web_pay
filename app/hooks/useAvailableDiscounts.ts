// File: src/hooks/useAvailableDiscounts.ts

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

/* =========================
 * Types
 * ========================= */
export interface Discount {
  id: string;
  createdAt: string;
  updatedAt: string;
  merchant: any;
  discountName: string;
  type: 'PERCENTAGE_OFF' | 'AMOUNT_OFF';
  discountPercentage?: number | null;
  discountAmount?: number | null;
  minimumPurchaseAmount?: number;
  singleUse: boolean;
  expiresAt?: string | null;
  redeemedBy: string[];
  applicableUsers: string[];
  checkout: any | null;
  expiredByMerchant: boolean;
}

/* =========================
 * Env helpers (web)
 * ========================= */
const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slashes
  }
  return undefined;
}

const HOST =
  pickValidApiHost(
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
  ) ?? 'http://192.168.1.121:8080';

/* =========================
 * API
 * ========================= */

async function fetchAvailableDiscounts(
  merchantId: string,
  orderAmount: number
): Promise<Discount[]> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');

  const resp = await axios.get<Discount[]>(
    `${HOST}/api/discounts/available/merchant`,
    {
      params: { merchantId, orderAmount },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // withCredentials: true, // enable only if your API needs cookies in addition to Bearer
    }
  );

  return resp.data;
}

/* =========================
 * Hook
 * ========================= */

export function useAvailableDiscounts(merchantId: string, orderAmount: number) {
  return useQuery<Discount[], Error>({
    queryKey: ['availableDiscounts', merchantId, orderAmount],
    queryFn: () => fetchAvailableDiscounts(merchantId, orderAmount),
    enabled: isBrowser && Boolean(merchantId) && Number(orderAmount) > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
