// File: src/hooks/useSmartpayDetailedPlan.ts

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import type { Frequency } from './useFinancialCalendarPlan';

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
  ) ?? 'http://localhost:8080';

/* =========================
 * Response Interfaces
 * ========================= */

export type SplitWindow = [string, string];

export interface SplitPayment {
  interestRate: number;
  originalInterestAmount: number;
  amount: number;
  originalAmount: number;
  interestFreeSlice: number;
  dueDate: string;
  percentage: number;
  interestAmount: number;
}

export interface PlanTerms {
  maxTerm: number;
  minTerm: number;
  frequency: Frequency;
}

export interface Plan {
  apr: number;
  currentTotalInterest: number;
  totalInterestRate: number;
  originalTotalInterest: number;
  possiblePlan: boolean;
  splitWindows: SplitWindow[];
  totalAmount: number;
  periodInterestRate: number;
  splitPayments: SplitPayment[];
  originalAmount: number;
  terms: PlanTerms;
  offsetDays: number;
  firstDueDate: string;
  startDate: string;
  interestFreeUsed: number;
  lastDueDate: string;
}

export interface CalendarSplitPayment {
  date: string;
  amount: number;
  type: string;
}

export interface CalendarPaymentCycle {
  interestRate: number;
  originalInterestAmount: number;
  amount: number;
  originalAmount: number;
  interestFreeSlice: number;
  dueDate: string;
  percentage: number;
  interestAmount: number;
}

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

export interface RentEvent {
  date: string;
  amount: number;
  type: string;
}

export interface AvoidedDate {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface PlanEvent {
  plannedPaymentDate: string;
  allocatedPayment: number;
}

export interface SmartpayDetailedResponse {
  plan: Plan;
  calendar: {
    splitPayments: CalendarSplitPayment[];
    paymentCycles: CalendarPaymentCycle[];
    incomeEvents: IncomeEvent[];
    liabilityEvents: LiabilityEvent[];
    rentEvents: RentEvent[];
    avoidedDates: AvoidedDate[];
    planEvents: PlanEvent[];
  };
  explanation: string;
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
 * Fetch Function (web)
 * ========================= */

async function fetchSmartpayDetailedPlanData(
  price: number,
  frequency: Frequency,
  instantaneous: boolean,
  yearly: boolean,
  interestFreeTotal: number
): Promise<SmartpayDetailedResponse> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No JWT token found');

  const response = await axiosInstance.get<SmartpayDetailedResponse>(
    '/api/smartpay/plan',
    {
      params: { price, frequency, instantaneous, yearly, interestFreeTotal },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}

/* =========================
 * React Query Hook
 * ========================= */

/**
 * Fetches a detailed SmartPay plan (including calendar and explanation)
 * for a given purchase amount, payment frequency, and additional options.
 *
 * @param price               the purchase price to plan for
 * @param frequency           the payment frequency (e.g. 'BI_WEEKLY' or 'MONTHLY')
 * @param instantaneous       whether to use instantaneous (splitWindow) pricing
 * @param yearly              whether to include yearly options
 * @param interestFreeTotal   total interest-free amount to apply
 */
export function useSmartpayDetailedPlan(
  price: number,
  frequency: Frequency,
  instantaneous: boolean,
  yearly: boolean,
  interestFreeTotal: number
) {
  return useQuery<SmartpayDetailedResponse, Error>({
    queryKey: [
      'smartpayDetailedPlan',
      price,
      frequency,
      instantaneous,
      yearly,
      interestFreeTotal,
    ],
    queryFn: () =>
      fetchSmartpayDetailedPlanData(
        price,
        frequency,
        instantaneous,
        yearly,
        interestFreeTotal
      ),
    enabled: isBrowser,             // avoid sessionStorage during SSR
    staleTime: 1000 * 60 * 5,       // cache for 5 minutes
    retry: 3,
  });
}
