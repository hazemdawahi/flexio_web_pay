// src/hooks/useSmartpayPreferencesMe.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SmartpayPreferences {
  id: string;
  livingSituation: 'RENTING' | 'OWNING' | 'PAYING_MORTGAGE' | string;
  rentAmount: number | null;
  rentDueDate: string | null;
  mortgageInstallmentAmount: number | null;
  grossIncome: number;
  grossIncomeFrequency:
    | 'WEEKLY'
    | 'BI_WEEKLY'
    | 'SEMI_MONTHLY'
    | 'MONTHLY'
    | 'YEARLY'
    | string;
  under150DurationMin: number;
  under150DurationMax: number;
  under150Frequency:
    | 'WEEKLY'
    | 'BI_WEEKLY'
    | 'SEMI_MONTHLY'
    | 'MONTHLY'
    | 'YEARLY'
    | string;
  range300to500DurationMin: number;
  range300to500DurationMax: number;
  range300to500Frequency:
    | 'WEEKLY'
    | 'BI_WEEKLY'
    | 'SEMI_MONTHLY'
    | 'MONTHLY'
    | 'YEARLY'
    | string;
  range1000to2000DurationMin: number;
  range1000to2000DurationMax: number;
  range1000to2000Frequency:
    | 'WEEKLY'
    | 'BI_WEEKLY'
    | 'SEMI_MONTHLY'
    | 'MONTHLY'
    | 'YEARLY'
    | string;
  range5000to10000DurationMin: number;
  range5000to10000DurationMax: number;
  range5000to10000Frequency:
    | 'WEEKLY'
    | 'BI_WEEKLY'
    | 'SEMI_MONTHLY'
    | 'MONTHLY'
    | 'YEARLY'
    | string;
  maximumMonthlyInstallment: number;
  optimumMonthlyInstallment: number;
}

export interface CreateSmartpayPreferencesRequest {
  livingSituation: SmartpayPreferences['livingSituation'];
  rentAmount: number | null;
  rentDueDate: string | null;
  mortgageInstallmentAmount: number | null;
  grossIncome: number;
  grossIncomeFrequency: SmartpayPreferences['grossIncomeFrequency'];
  under150DurationMin: number;
  under150DurationMax: number;
  under150Frequency: SmartpayPreferences['under150Frequency'];
  range300to500DurationMin: number;
  range300to500DurationMax: number;
  range300to500Frequency: SmartpayPreferences['range300to500Frequency'];
  range1000to2000DurationMin: number;
  range1000to2000DurationMax: number;
  range1000to2000Frequency: SmartpayPreferences['range1000to2000Frequency'];
  range5000to10000DurationMin: number;
  range5000to10000DurationMax: number;
  range5000to10000Frequency: SmartpayPreferences['range5000to10000Frequency'];
  maximumMonthlyInstallment: number;
  optimumMonthlyInstallment: number;
}

/* ---------------- Env helpers: sanitize and require absolute http(s) ---------------- */
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

/* ---------------- Token helper (web) ---------------- */
async function getWebToken(): Promise<string> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');
  return token;
}

/* ---------------- API: GET /api/smartpay-preferences/me ---------------- */
export async function fetchSmartpayPreferencesMe(): Promise<SmartpayPreferences> {
  const token = await getWebToken();

  const res = await fetch(`${SERVER_BASE_URL}/api/smartpay-preferences/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    // credentials: 'include', // enable only if your API needs cookies
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status}: ${res.statusText}${text ? ` - ${text}` : ''}`);
  }

  const json = (await res.json()) as SmartpayPreferences;
  return json;
}

/* ---------------- Hook: useSmartpayPreferencesMe ---------------- */
export function useSmartpayPreferencesMe() {
  return useQuery<SmartpayPreferences, Error>({
    queryKey: ['smartpayPreferencesMe'],
    queryFn: fetchSmartpayPreferencesMe,
    enabled: isBrowser,          // avoid sessionStorage during SSR
    staleTime: 1000 * 60 * 5,    // 5 minutes
  });
}

/* ---------------- API: POST /api/smartpay-preferences ---------------- */
export async function createSmartpayPreferences(
  payload: CreateSmartpayPreferencesRequest
): Promise<SmartpayPreferences> {
  const token = await getWebToken();

  const res = await fetch(`${SERVER_BASE_URL}/api/smartpay-preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    // credentials: 'include', // enable only if your API needs cookies
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status}: ${res.statusText}${text ? ` - ${text}` : ''}`);
  }

  const json = (await res.json()) as SmartpayPreferences;
  return json;
}

/* ---------------- Hook: useCreateSmartpayPreferences ---------------- */
export function useCreateSmartpayPreferences() {
  const queryClient = useQueryClient();

  return useMutation<SmartpayPreferences, Error, CreateSmartpayPreferencesRequest>({
    mutationFn: createSmartpayPreferences,
    onSuccess: () => {
      // refresh the "me" query so UI reflects latest preferences
      queryClient.invalidateQueries({ queryKey: ['smartpayPreferencesMe'] });
    },
  });
}
