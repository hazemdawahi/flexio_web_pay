// File: src/hooks/useFinancialCalendarPlan.ts

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import {
  authFetch,
  AuthError,
  isBrowser,
  getAccessToken,
} from "~/lib/auth/apiClient";

/* =========================
 * Allowed frequency values
 * ========================= */
export type Frequency =
  | "BI_WEEKLY"
  | "MONTHLY"
  | "WEEKLY"
  | "SEMI_MONTHLY"
  | "DAILY"
  | "YEARLY";

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
 * Fetcher (authenticated via authFetch)
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
    // authFetch will attach the token from central storage and handle refresh/AuthError.
    const url = `/api/financial-calendar/plan?price=${encodeURIComponent(
      price
    )}&frequency=${encodeURIComponent(frequency)}`;

    return await authFetch<FinancialCalendarPlanData>(url);
  } catch (error: any) {
    const serverMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message;
    console.error("Error fetching financial calendar plan data:", serverMsg);
    throw new Error(serverMsg || "Failed to fetch financial calendar plan data");
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
  const navigate = useNavigate();
  const token = isBrowser ? getAccessToken() : null;

  const query = useQuery<FinancialCalendarPlanData, Error>({
    queryKey: ["financialCalendarPlan", price, frequency],
    queryFn: () => fetchFinancialCalendarPlanData(price, frequency),
    enabled: isBrowser && !!token && price > 0, // avoid SSR & require token and valid price
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 3, // Retry failed requests up to 3 times
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
