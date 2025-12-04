// File: src/hooks/useCalculatePaymentPlan.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

/* ---------------- Env helpers (web) ---------------- */
const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slash(es)
  }
  return undefined;
}

function getBaseUrl(): string {
  return (
    pickValidApiHost(
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
    ) || 'http://localhost:8080'
  );
}

/* ---------------- Token helper (web) ---------------- */
async function getWebToken(): Promise<string> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');
  return token;
}

/* ---------------- Request Interfaces ---------------- */

// Align frequency exactly with com.example.stripedemo.Enum.Frequency
export type PaymentFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BI_WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY'
  | 'YEARLY';

export interface CalculatePaymentPlanRequest {
  frequency: PaymentFrequency;
  numberOfPayments: number;
  purchaseAmount: number;    // e.g. 1200.00
  startDate?: string;        // optional, "YYYY-MM-DD"
  selfPay?: boolean;         // optional
  instantaneous?: boolean;   // optional
  yearly?: boolean;          // optional
  interestFreeAmt?: number;  // optional, e.g. 100.00
}

/* ---------------- Response Interfaces ---------------- */
export interface SplitPayment {
  dueDate: string;                // ISO date, e.g. "2025-07-15"
  amount: number;                 // e.g. 218.50
  originalAmount: number;         // e.g. 200.00
  interestFreeSlice: number;      // e.g. 100.00
  interestRate: number;           // e.g. 0.0225
  interestAmount: number;         // e.g. 4.50
  originalInterestAmount: number; // e.g. 4.50
}

export interface CalculatePaymentPlanData {
  originalAmount: number;        // e.g. 1200.00
  interestFreeUsed: number;      // e.g. 100.00
  periodInterestRate: number;    // e.g. 0.0225
  totalInterestRate: number;     // e.g. 0.1350
  apr: number;                   // e.g. 0.2700
  totalAmount: number;           // e.g. 1281.00
  originalTotalInterest: number; // e.g. 81.00
  currentTotalInterest: number;  // e.g. 81.00
  offsetDays: number;            // e.g. 15
  startDate: string;             // e.g. "2025-07-15"
  splitPayments: SplitPayment[];
  financialCalendar: Record<string, string[]>;  // mapping dates to array of strings
}

export interface CalculatePaymentPlanResponse {
  success: boolean;
  data: CalculatePaymentPlanData | null;
  error: string | null;
}

/* ---------------- API Call + adapter to parse string-numbers (web) ---------------- */
export async function calculatePaymentPlan(
  planRequest: CalculatePaymentPlanRequest
): Promise<CalculatePaymentPlanResponse> {
  const token = await getWebToken();

  // Build request payload exactly as your example
  const payload: Record<string, any> = {
    frequency: planRequest.frequency,                         // e.g. "MONTHLY"
    numberOfPayments: planRequest.numberOfPayments,
    purchaseAmount: planRequest.purchaseAmount.toFixed(2),    // "1200.00"
    selfPay: planRequest.selfPay ?? false,
    instantaneous: planRequest.instantaneous ?? false,
    yearly: planRequest.yearly ?? false,
    interestFreeAmt: Number(planRequest.interestFreeAmt ?? 0).toFixed(2),
  };
  if (planRequest.startDate) {
    payload.startDate = planRequest.startDate;                // "YYYY-MM-DD"
  }

  const response = await fetch(`${getBaseUrl()}/api/payment-plans/calculate`, {
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

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Payment plan calculation failed: ${response.status} ${response.statusText}${text ? ` – ${text}` : ''}`
    );
  }

  // Parse and convert string-numbers to actual numbers
  const raw = (await response.json()) as CalculatePaymentPlanResponse;
  if (raw.success && raw.data) {
    const d = raw.data as any;
    const parsedData: CalculatePaymentPlanData = {
      originalAmount: parseFloat(d.originalAmount),
      interestFreeUsed: parseFloat(d.interestFreeUsed),
      periodInterestRate: parseFloat(d.periodInterestRate),
      totalInterestRate: parseFloat(d.totalInterestRate),
      apr: parseFloat(d.apr),
      totalAmount: parseFloat(d.totalAmount),
      originalTotalInterest: parseFloat(d.originalTotalInterest),
      currentTotalInterest: parseFloat(d.currentTotalInterest),
      offsetDays: d.offsetDays,
      startDate: d.startDate,
      splitPayments: Array.isArray(d.splitPayments)
        ? d.splitPayments.map((sp: any) => ({
            dueDate: sp.dueDate,
            amount: parseFloat(sp.amount),
            originalAmount: parseFloat(sp.originalAmount),
            interestFreeSlice: parseFloat(sp.interestFreeSlice),
            interestRate: parseFloat(sp.interestRate),
            interestAmount: parseFloat(sp.interestAmount),
            originalInterestAmount: parseFloat(sp.originalInterestAmount),
          }))
        : [],
      financialCalendar: d.financialCalendar ?? {},
    };
    return { success: true, data: parsedData, error: null };
  }

  // If not successful or no data, return as-is
  return raw;
}

/* ---------------- React Query Hook ---------------- */
export function useCalculatePaymentPlan() {
  const queryClient = useQueryClient();

  return useMutation<CalculatePaymentPlanResponse, Error, CalculatePaymentPlanRequest>({
    mutationFn: calculatePaymentPlan,
    onSuccess: () => {
      // Invalidate any queries that list or use payment-plans
      queryClient.invalidateQueries({ queryKey: ['paymentPlans'] });
    },
    onError: (error) => {
      console.error('Payment plan calculation failed:', error.message);
    },
  });
}
