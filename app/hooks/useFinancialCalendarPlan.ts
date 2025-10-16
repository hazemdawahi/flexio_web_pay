// File: src/hooks/useFinancialCalendarPlan.ts

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

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
 * Allowed frequency values
 * ========================= */
export type Frequency =
  | 'BI_WEEKLY'
  | 'MONTHLY'
  | 'WEEKLY'
  | 'SEMI_MONTHLY'
  | 'DAILY'
  | 'YEARLY';

/* =========================
 * DTOs
 * ========================= */
export interface IncomeEvent {
  date: string;
  amount: number;
  provider: string;
}

export interface LiabilityEvent {
  date: string;
  amount: number;
  type: string;
}

export interface SplitPayment {
  date: string;
  amount: number;
  type: string;
}

export interface RentEvent {
  date: string;
  amount: number;
  type: string;
}

export interface AvoidedDate {
  id: string;
  startDate: string;
  endDate: string;
  name: string;
}

export interface PlanEvent {
  plannedPaymentDate: string;
  allocatedPayment: number;
}

export interface FinancialCalendarPlanData {
  splitPayments: SplitPayment[];
  incomeEvents: IncomeEvent[];
  liabilityEvents: LiabilityEvent[];
  rentEvents: RentEvent[];
  avoidedDates: AvoidedDate[];
  planEvents: PlanEvent[];
}

/* =========================
 * Axios instance (web)
 * ========================= */
const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
  },
  // withCredentials: true, // enable only if your API needs cookies
});

/* =========================
 * Fetcher (web)
 * ========================= */
/**
 * Fetches the financial calendar plan for a given price and frequency.
 * @param price the purchase price to plan for
 * @param frequency how often payments should occur
 */
export async function fetchFinancialCalendarPlanData(
  price: number,
  frequency: Frequency
): Promise<FinancialCalendarPlanData> {
  try {
    if (!isBrowser) throw new Error('Token storage unavailable during SSR');
    const token = window.sessionStorage.getItem('accessToken');
    if (!token) throw new Error('No JWT token found');

    const response = await axiosInstance.get<FinancialCalendarPlanData>(
      '/api/financial-calendar/plan',
      {
        params: { price, frequency },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    // Prefer server message when available
    const serverMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message;
    console.error('Error fetching financial calendar plan data:', serverMsg);
    throw new Error(serverMsg || 'Failed to fetch financial calendar plan data');
  }
}

/* =========================
 * React Query Hook
 * ========================= */
/**
 * Custom hook to fetch financial calendar plan data using react-query.
 * @param price the purchase price to plan for (e.g. 450)
 * @param frequency one of the supported frequencies (e.g. 'BI_WEEKLY')
 */
export function useFinancialCalendarPlan(price: number, frequency: Frequency) {
  return useQuery<FinancialCalendarPlanData, Error>({
    queryKey: ['financialCalendarPlan', price, frequency],
    queryFn: () => fetchFinancialCalendarPlanData(price, frequency),
    enabled: isBrowser,            // avoid sessionStorage during SSR
    staleTime: 1000 * 60 * 5,      // Cache for 5 minutes
    retry: 3,                      // Retry failed requests up to 3 times
  });
}
