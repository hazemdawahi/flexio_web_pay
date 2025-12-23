// src/hooks/usePaymentMethods.ts
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

/* =========================
 * Types
 * ========================= */
export interface Card {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
  country: string;
  primary: boolean;
  [key: string]: any;
}

export interface BankAccount {
  institutionLogo: string;
  institutionName: string;
  needsReconnection: boolean;
  accounts: Array<{
    accountName: string;
    mask: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface PaymentMethod {
  type: "card" | "bank";
  id: string;
  created?: number;
  card?: Card;
  bank?: BankAccount;
  [key: string]: any;
}

export interface PaymentMethodsResponse {
  success: boolean;
  data: {
    data: PaymentMethod[];
    cardCount: number;
    bankAccountCount: number;
    error: any;
    [key: string]: any;
  };
  error: any;
}

/* =========================
 * Hook (Auth Query)
 * ========================= */
/**
 * STRICT per-user cache partition.
 * - Only runs when a real userId exists (no "anon" fallback)
 * - Uses authFetch so it attaches the access token automatically
 * - Redirects to /login if the token is invalid / expired (AuthError)
 *
 * Usage:
 *   const paymentMethodsQuery = usePaymentMethods(user?.id)
 *   const methods = paymentMethodsQuery.data // PaymentMethod[] | undefined
 */
export function usePaymentMethods(userId: string | undefined) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<PaymentMethod[], Error>({
    queryKey: ["paymentMethods", userId],
    queryFn: async () => {
      // Use authFetch so it adds Authorization and handles 401 as AuthError
      const json = await authFetch<PaymentMethodsResponse>(
        `/customer/payment-methods?t=${Date.now()}`
      );

      if (!json?.success) {
        throw new Error(
          `Payment methods API error: ${
            json?.error ?? json?.data?.error ?? "unknown"
          }`
        );
      }

      return json.data?.data ?? [];
    },
    enabled: !!token && !!userId && isBrowser, // require token + known userId + browser
    placeholderData: keepPreviousData,
    // Use global staleTime/gcTime/refetchOnWindowFocus from QueryClient config
    // This ensures consistent caching and prevents refetch on back navigation
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
