// src/hooks/usePlaidTokens.ts

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from "~/lib/auth/apiClient";

// Interfaces for Plaid Tokens Response
export interface PlaidTokensData {
  hasPlaidLiabilityAccessToken: boolean;
  hasPlaidUserToken: boolean;
  hasRequiredTokens: boolean;
}

export interface PlaidTokensResponse {
  success: boolean;
  data: PlaidTokensData | null; // now an object of flags, or null on error
  error: string | null;
}

// Async function to check if user has required Plaid tokens
export async function fetchPlaidTokensStatus(): Promise<PlaidTokensResponse> {
  try {
    // Use centralized authFetch (adds Authorization, base URL, etc.)
    const json = await authFetch<PlaidTokensResponse>(
      "/api/user/has-required-plaid-tokens",
      {
        method: "GET",
      }
    );

    return json;
  } catch (error: any) {
    // IMPORTANT: let AuthError bubble up so the hook can redirect to /login
    if (error instanceof AuthError) {
      throw error;
    }

    return {
      success: false,
      data: null,
      error: error?.message || "Failed to check Plaid tokens",
    };
  }
}

// Custom hook to fetch Plaid tokens status using useQuery (Auth Query)
export function usePlaidTokensStatus() {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<PlaidTokensResponse, Error>({
    queryKey: ["plaidTokensStatus", token],
    queryFn: fetchPlaidTokensStatus,
    enabled: !!token && isBrowser,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
