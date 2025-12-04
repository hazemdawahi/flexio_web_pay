import { useQuery } from '@tanstack/react-query';

export type Frequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BI_WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY'
  | 'YEARLY';

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
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined,
  ) ?? 'http://localhost:8080';

/* ---------------- API ---------------- */
async function getTokenFromSession(): Promise<string> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');
  return token;
}

export async function fetchSmartpayIncomesWeb(): Promise<SmartpayIncomeDetail[]> {
  const token = await getTokenFromSession();

  const res = await fetch(`${SERVER_BASE_URL}/api/smartpay-incomes`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    // credentials: 'include', // enable only if this endpoint requires cookies
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status}: ${res.statusText}${text ? ` – ${text}` : ''}`);
  }

  const json = (await res.json()) as ListSmartpayIncomesResponse;
  if (!json.success) {
    throw new Error(json.error ?? 'Unknown error');
  }

  return json.data;
}

/* ---------------- Hook ---------------- */
export function useSmartpayIncomes() {
  return useQuery<SmartpayIncomeDetail[], Error>({
    queryKey: ['smartpayIncomes'],
    queryFn: fetchSmartpayIncomesWeb,
    enabled: isBrowser,            // avoid trying to read sessionStorage on server
    staleTime: 1000 * 60 * 5,      // 5 minutes
  });
}
