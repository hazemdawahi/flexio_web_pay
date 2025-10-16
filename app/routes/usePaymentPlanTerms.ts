// File: src/hooks/usePaymentPlanTerms.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

/* ---------------- Env helpers (web) ---------------- */
const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slash
  }
  return undefined;
}

function getBaseUrl(): string {
  return (
    pickValidApiHost(
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined,
    ) || 'http://192.168.1.121:8080'
  );
}

/* ---------------- Token helper (web) ---------------- */
async function getWebToken(): Promise<string> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');
  return token;
}

/* ---------------- Request / Response Types ---------------- */
// Align exactly with com.example.stripedemo.Enum.Frequency
export type PaymentFrequency = 'BI_WEEKLY' | 'MONTHLY';

export interface CalculateTermsRequest {
  frequency: PaymentFrequency;
  purchaseAmount: number;     // e.g. 500.00
  instantaneous?: boolean;    // optional, defaults to false
  yearly?: boolean;           // optional, defaults to false
}

export interface Terms {
  frequency: PaymentFrequency;
  minTerm?: number;
  maxTerm?: number;
}

export interface CalculateTermsResponse {
  success: boolean;
  data: Terms;
  error: string | null;
}

/* ---------------- API Call + adapter (web) ---------------- */
export async function fetchPaymentPlanTerms(
  req: CalculateTermsRequest
): Promise<CalculateTermsResponse> {
  const token = await getWebToken();

  const payload: Record<string, any> = {
    // send the enum value directly
    frequency: req.frequency,
    // backend expects a decimal string; keep exactly 2 fractional digits
    purchaseAmount: req.purchaseAmount.toFixed(2),
    instantaneous: req.instantaneous ?? false,
    yearly: req.yearly ?? false,
  };

  const response = await fetch(`${getBaseUrl()}/api/payment-plans/terms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: JSON.stringify(payload),
    // credentials: 'include', // enable only if your API requires cookies
  });

  // Parse body as JSON when possible; fall back to a shaped error
  const text = await response.text();
  let raw: CalculateTermsResponse;
  try {
    raw = JSON.parse(text) as CalculateTermsResponse;
  } catch {
    raw = {
      success: false,
      data: { frequency: req.frequency } as Terms,
      error: text || `HTTP ${response.status} ${response.statusText}`,
    };
  }

  // Return server payload regardless of HTTP status (mirrors original behavior)
  return raw;
}

/* ---------------- React Query Hook ---------------- */
export function usePaymentPlanTerms() {
  const queryClient = useQueryClient();

  return useMutation<CalculateTermsResponse, Error, CalculateTermsRequest>({
    mutationFn: fetchPaymentPlanTerms,
    onSuccess: () => {
      // invalidate any dependent queries
      queryClient.invalidateQueries({ queryKey: ['paymentPlanTerms'] });
    },
    onError: (err) => {
      console.error('Fetching payment-plan terms failed:', err.message);
    },
  });
}
