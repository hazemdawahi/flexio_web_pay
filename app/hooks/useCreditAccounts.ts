// src/hooks/useCreditAccounts.ts
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@remix-run/react';
import { useEffect } from 'react';
import {
  authFetch,
  isBrowser,
  getAccessToken,
  AuthError,
} from '~/lib/auth/apiClient';

// --- Interfaces ------------------------------------------------------------

// Represents a single account inside a token
export interface CreditAccount {
  accountId: string;
  interestFree: boolean;
  accountName: string;
  id: string;
  mask: string;
}

// Represents one “token” object returned by the API
export interface CreditToken {
  needsReconnection: boolean;
  institutionId: string;
  institutionName: string;
  institutionLogo: string | null; // base64 PNG or null
  accounts: CreditAccount[];
  accessToken: string;
}

// The “data” object wrapping the tokens array
export interface CreditAccountsData {
  tokens: CreditToken[];
}

// Top‐level response shape from the backend
export interface CreditAccountsResponse {
  success: boolean;
  data: CreditAccountsData | null;
  error: string | null;
}

// --- Fetch function (using centralized authFetch) --------------------------

async function fetchCreditAccounts(): Promise<CreditAccountsResponse> {
  // authFetch handles base URL, token, and throws AuthError on 401
  return authFetch<CreditAccountsResponse>('/api/credit-accounts');
}

// --- Hook ---------------------------------------------------------------

/**
 * React-Query hook to fetch credit‐account tokens.
 *
 * Query Key: ['creditAccounts']
 * Pattern: Authenticated Query (requires login, redirects on 401)
 */
export function useCreditAccounts() {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<CreditAccountsResponse, Error>({
    queryKey: ['creditAccounts', token],
    queryFn: fetchCreditAccounts,
    refetchOnWindowFocus: true,
    enabled: !!token && isBrowser, // avoid accessing storage during SSR
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate('/login', { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
