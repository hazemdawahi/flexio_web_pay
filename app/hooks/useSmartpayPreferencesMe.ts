// src/hooks/useSmartpayPreferencesMe.ts

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

export interface SmartpayPreferences {
  id: string;
  livingSituation: "RENTING" | "OWNING" | "PAYING_MORTGAGE" | string;
  rentAmount: number | null;
  rentDueDate: string | null;
  mortgageInstallmentAmount: number | null;
  grossIncome: number;
  grossIncomeFrequency:
    | "WEEKLY"
    | "BI_WEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "YEARLY"
    | string;
  under150DurationMin: number;
  under150DurationMax: number;
  under150Frequency:
    | "WEEKLY"
    | "BI_WEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "YEARLY"
    | string;
  range300to500DurationMin: number;
  range300to500DurationMax: number;
  range300to500Frequency:
    | "WEEKLY"
    | "BI_WEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "YEARLY"
    | string;
  range1000to2000DurationMin: number;
  range1000to2000DurationMax: number;
  range1000to2000Frequency:
    | "WEEKLY"
    | "BI_WEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "YEARLY"
    | string;
  range5000to10000DurationMin: number;
  range5000to10000DurationMax: number;
  range5000to10000Frequency:
    | "WEEKLY"
    | "BI_WEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "YEARLY"
    | string;
  maximumMonthlyInstallment: number;
  optimumMonthlyInstallment: number;
}

export interface CreateSmartpayPreferencesRequest {
  livingSituation: SmartpayPreferences["livingSituation"];
  rentAmount: number | null;
  rentDueDate: string | null;
  mortgageInstallmentAmount: number | null;
  grossIncome: number;
  grossIncomeFrequency: SmartpayPreferences["grossIncomeFrequency"];
  under150DurationMin: number;
  under150DurationMax: number;
  under150Frequency: SmartpayPreferences["under150Frequency"];
  range300to500DurationMin: number;
  range300to500DurationMax: number;
  range300to500Frequency: SmartpayPreferences["range300to500Frequency"];
  range1000to2000DurationMin: number;
  range1000to2000DurationMax: number;
  range1000to2000Frequency: SmartpayPreferences["range1000to2000Frequency"];
  range5000to10000DurationMin: number;
  range5000to10000DurationMax: number;
  range5000to10000Frequency: SmartpayPreferences["range5000to10000Frequency"];
  maximumMonthlyInstallment: number;
  optimumMonthlyInstallment: number;
}

/* ---------------- API: GET /api/smartpay-preferences/me ---------------- */
export async function fetchSmartpayPreferencesMe(): Promise<SmartpayPreferences> {
  // authFetch will:
  // - attach Authorization header using the current access token
  // - use the centralized API base URL
  // - throw AuthError on 401 so callers can redirect to /login
  const json = await authFetch<SmartpayPreferences>(
    "/api/smartpay-preferences/me",
    {
      method: "GET",
    }
  );

  return json;
}

/* ---------------- Hook: useSmartpayPreferencesMe (Auth Query) ---------------- */
export function useSmartpayPreferencesMe() {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<SmartpayPreferences, Error>({
    queryKey: ["smartpayPreferencesMe", token],
    queryFn: fetchSmartpayPreferencesMe,
    enabled: !!token && isBrowser, // avoid SSR & require auth
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}

/* ---------------- API: POST /api/smartpay-preferences ---------------- */
export async function createSmartpayPreferences(
  payload: CreateSmartpayPreferencesRequest
): Promise<SmartpayPreferences> {
  const json = await authFetch<SmartpayPreferences>(
    "/api/smartpay-preferences",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return json;
}

/* ---------------- Hook: useCreateSmartpayPreferences (Auth Mutation) ---------------- */
export function useCreateSmartpayPreferences() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<SmartpayPreferences, Error, CreateSmartpayPreferencesRequest>({
    mutationFn: createSmartpayPreferences,
    onSuccess: () => {
      // refresh the "me" query so UI reflects latest preferences
      queryClient.invalidateQueries({ queryKey: ["smartpayPreferencesMe"] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Failed to create Smartpay preferences:", error.message);
    },
  });
}
