// File: src/hooks/useSmartpayDetailedPlan.ts

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import type { Frequency } from "./useFinancialCalendarPlan";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

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
 * Fetch Function (via authFetch)
 * ========================= */

async function fetchSmartpayDetailedPlanData(
  price: number,
  frequency: Frequency,
  instantaneous: boolean,
  yearly: boolean,
  interestFreeTotal: number
): Promise<SmartpayDetailedResponse> {
  if (!isBrowser) throw new Error("Token storage unavailable during SSR");

  const params = new URLSearchParams({
    price: String(price),
    frequency,
    instantaneous: String(instantaneous),
    yearly: String(yearly),
    interestFreeTotal: String(interestFreeTotal),
  });

  // authFetch will:
  // - attach Authorization header using current access token
  // - use centralized API base URL
  // - throw AuthError on 401 so the hook can redirect
  return authFetch<SmartpayDetailedResponse>(`/api/smartpay/plan?${params.toString()}`, {
    method: "GET",
  });
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
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<SmartpayDetailedResponse, Error>({
    queryKey: [
      "smartpayDetailedPlan",
      price,
      frequency,
      instantaneous,
      yearly,
      interestFreeTotal,
      token,
    ],
    queryFn: () =>
      fetchSmartpayDetailedPlanData(
        price,
        frequency,
        instantaneous,
        yearly,
        interestFreeTotal
      ),
    enabled: !!token && isBrowser, // avoid SSR + require auth
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
    retry: 3,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
