// src/hooks/useCreditAccounts.ts
import { useQuery } from '@tanstack/react-query';

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

// --- Env helpers: sanitize and require absolute http(s) --------------------

const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slash
  }
  return undefined;
}

const SERVER_BASE_URL =
  pickValidApiHost(
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
  ) ?? 'http://localhost:8080';

// --- Fetch function --------------------------------------------------------

async function fetchCreditAccounts(): Promise<CreditAccountsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    if (!isBrowser) throw new Error('Token storage unavailable during SSR');
    const token = window.sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }

    const res = await fetch(`${SERVER_BASE_URL}/api/credit-accounts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
      // credentials: 'include', // enable only if your API requires cookies
    });

    if (!res.ok) {
      // try to read json error; fallback to status text
      let errBody: any = null;
      try {
        errBody = await res.json();
      } catch {
        // ignore
      }
      throw new Error(
        `Fetch credit accounts failed: ${errBody?.error ?? res.statusText}`
      );
    }

    // Parse the JSON into our typed interface
    return (await res.json()) as CreditAccountsResponse;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Hook ---------------------------------------------------------------

/**
 * React-Query hook to fetch credit‐account tokens.
 *
 * Query Key: ['creditAccounts']
 */
export function useCreditAccounts() {
  return useQuery<CreditAccountsResponse, Error>({
    queryKey: ['creditAccounts'],
    queryFn: fetchCreditAccounts,
    refetchOnWindowFocus: true,
    enabled: isBrowser, // avoid accessing sessionStorage during SSR
    staleTime: 1000 * 60 * 5, // optional: cache for 5 minutes
  });
}
