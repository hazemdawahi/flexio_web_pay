// src/hooks/usePaymentMethods.ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';

/* =========================
 * Types
 * ========================= */
export interface Card {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
  country: string;
  primary: boolean;
  [key: string]: any;
}

export interface BankAccount {
  institutionLogo: string;
  institutionName: string;
  needsReconnection: boolean;
  accounts: Array<{
    accountName: string;
    mask: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface PaymentMethod {
  type: 'card' | 'bank';
  id: string;
  created?: number;
  card?: Card;
  bank?: BankAccount;
  [key: string]: any;
}

export interface PaymentMethodsResponse {
  success: boolean;
  data: {
    data: PaymentMethod[];
    cardCount: number;
    bankAccountCount: number;
    error: any;
    [key: string]: any;
  };
  error: any;
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

const API_BASE =
  pickValidApiHost(
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
  ) ?? 'http://192.168.1.121:8080';

/* =========================
 * API
 * ========================= */
async function fetchPaymentMethodsStrict(): Promise<PaymentMethod[]> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');

  const res = await fetch(`${API_BASE}/customer/payment-methods?t=${Date.now()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    // credentials: 'include', // enable only if your API needs cookies in addition to the Bearer token
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Payment methods HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }

  const json = (await res.json()) as PaymentMethodsResponse;

  if (!json?.success) {
    throw new Error(
      `Payment methods API error: ${json?.error ?? json?.data?.error ?? 'unknown'}`
    );
  }

  return json?.data?.data ?? [];
}

/* =========================
 * Hook
 * ========================= */
/**
 * STRICT per-user cache partition.
 * - Only runs when a real userId exists (no "anon" fallback)
 * - Returns PaymentMethod[] directly
 *
 * Usage:
 *   const { data, isLoading, error } = usePaymentMethods(user?.id)
 */
export function usePaymentMethods(userId: string | undefined) {
  return useQuery<PaymentMethod[], Error>({
    queryKey: ['paymentMethods', userId], // unique per identity
    queryFn: fetchPaymentMethodsStrict,
    enabled: !!userId && isBrowser,       // never run for unknown identity or during SSR
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,             // optional: cache for 5 minutes
    refetchOnWindowFocus: true,
  });
}
