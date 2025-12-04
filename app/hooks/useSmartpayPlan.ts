import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

// --- Response Interfaces ---

export interface SplitPaymentDue {
  id: string;
  amount: number;
  dueDate: string;
  declaredExpectedPayDate: string | null;
  declaredReason: string | null;
  declaredExplanation: string | null;
  paidStatus: string;
  paymentDate: string | null;
  paymentMethodId: string | null;
  late: boolean;
  lateDeclared: boolean;
  extensionCount: number;
  paymentIntentId: string | null;
  defaulted: boolean;
  partPay: boolean;
  slidableCount: number;
  refunds: any[];
  createdAt: string;
  updatedAt: string;
}

export interface RentDue {
  rentAmount: number;
  rentDueDate: string;
}

export interface Cycle {
  cycleLabel: string;
  startDate: string;
  endDate: string;
  plannedPaymentDate: string;
  incomeAmount: number;
  creditLiabilitiesDue: any[];
  splitPaymentsDue: SplitPaymentDue[];
  rentDue: RentDue | null;
  totalAmount: number;
  allocatedPayment: number;
  percentage: number;
}

export interface SmartpayPlanResponse {
  purchaseAmount: number;
  termMonths: number;
  modelType: string;
  mae: number;
  cycles: Cycle[];
}

// --- Fetch Function ---

/**
 * Fetches the smart-pay plan for a given price.
 * @param price the purchase price to plan for
 */
async function fetchSmartpayPlanData(
  price: number
): Promise<SmartpayPlanResponse> {
  const url = `/api/smartpay/plan?price=${encodeURIComponent(price)}`;

  const data = await authFetch<SmartpayPlanResponse>(url, {
    method: "GET",
  });

  console.log("Smartpay plan response:", data);
  return data;
}

// --- React Query Hook ---

/**
 * Custom hook to fetch smart-pay plan data.
 * Only runs if an access token is available (via getAccessToken) in the browser.
 */
export function useSmartpayPlan(price: number) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<SmartpayPlanResponse, Error>({
    queryKey: ["smartpayPlan", price, token],
    queryFn: () => fetchSmartpayPlanData(price),
    enabled: !!token && isBrowser,
    staleTime: 1000 * 60 * 5,
    retry: 3,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
