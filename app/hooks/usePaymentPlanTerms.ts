// File: src/hooks/usePaymentPlanTerms.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

/* ---------------- Request / Response Types ---------------- */
// Align exactly with com.example.stripedemo.Enum.Frequency
export type PaymentFrequency = "BI_WEEKLY" | "MONTHLY";

export interface CalculateTermsRequest {
  frequency: PaymentFrequency;
  purchaseAmount: number; // e.g. 500.00
  instantaneous?: boolean; // optional, defaults to false
  yearly?: boolean; // optional, defaults to false
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

/* ---------------- API Call (via authFetch) ---------------- */
export async function fetchPaymentPlanTerms(
  req: CalculateTermsRequest
): Promise<CalculateTermsResponse> {
  const payload: Record<string, any> = {
    // send the enum value directly
    frequency: req.frequency,
    // backend expects a decimal string; keep exactly 2 fractional digits
    purchaseAmount: req.purchaseAmount.toFixed(2),
    instantaneous: req.instantaneous ?? false,
    yearly: req.yearly ?? false,
  };

  // authFetch:
  // - attaches Authorization header using the current access token
  // - uses the centralized API base URL
  // - throws AuthError on 401 so caller can redirect to /login
  return authFetch<CalculateTermsResponse>("/api/payment-plans/terms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------------- React Query Hook (Auth Mutation) ---------------- */
export function usePaymentPlanTerms() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<CalculateTermsResponse, Error, CalculateTermsRequest>({
    mutationFn: fetchPaymentPlanTerms,
    onSuccess: () => {
      // invalidate any dependent queries
      queryClient.invalidateQueries({ queryKey: ["paymentPlanTerms"] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Fetching payment-plan terms failed:", error.message);
    },
  });
}
