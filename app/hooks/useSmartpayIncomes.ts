import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

export type Frequency =
  | "DAILY"
  | "WEEKLY"
  | "BI_WEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY"
  | "YEARLY";

export interface SmartpayIncomeDetail {
  id: string;
  amount: number;
  frequency: Frequency;
  lastPaymentDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ListSmartpayIncomesResponse {
  success: boolean;
  data: SmartpayIncomeDetail[];
  error: string | null;
}

/* ---------------- API via authFetch ---------------- */
export async function fetchSmartpayIncomesWeb(): Promise<SmartpayIncomeDetail[]> {
  const json = await authFetch<ListSmartpayIncomesResponse>(
    "/api/smartpay-incomes",
    {
      method: "GET",
    }
  );

  if (!json.success) {
    throw new Error(json.error ?? "Unknown error");
  }

  return json.data;
}

/* ---------------- Hook (Auth Query) ---------------- */
export function useSmartpayIncomes() {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<SmartpayIncomeDetail[], Error>({
    // FIXED: Removed token from query key (anti-pattern)
    queryKey: ["smartpay", "incomes"],
    queryFn: fetchSmartpayIncomesWeb,
    enabled: !!token && isBrowser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
    // Keep previous data while fetching
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
