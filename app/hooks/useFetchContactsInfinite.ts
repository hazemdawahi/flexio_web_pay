// File: src/hooks/useFetchContactsInfinite.ts
import { useInfiniteQuery, type QueryFunctionContext, type QueryKey } from '@tanstack/react-query';

/* =========================
 * Env helpers (web)
 * ========================= */
const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slashes
  }
  return undefined;
}

const BASE_URL =
  pickValidApiHost(
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
    (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined
  ) ?? 'http://192.168.1.121:8080';

/* =========================
 * Types
 * ========================= */
interface ContactItem {
  phoneNumber: string;
  logo: string | null;
  id: string;
  username: string;
  isSubscribed: boolean;
}

interface PageableMeta {
  pageNumber: number;
  totalPages: number;
}

interface ContactResponse {
  success: boolean;
  data: {
    content: ContactItem[];
    pageable: PageableMeta;
    last: boolean;
  } | null;
  error: string | null;
}

/** Allow arrays or comma-separated strings, pass through as-is (controller accepts both). */
type MaybeArrayOrCSV = string[] | string | undefined;
type MaybeBooleanOrString = boolean | 'true' | 'false' | undefined;

/* =========================
 * Fetcher (web)
 * ========================= */
async function fetchContacts(
  { pageParam }: QueryFunctionContext<QueryKey, unknown>,
  size: number,
  contacts: MaybeArrayOrCSV,
  searchTerm?: string,
  isSubscribed?: MaybeBooleanOrString,
  excludeUserIds?: MaybeArrayOrCSV,
  sort: string = 'username,asc'
): Promise<ContactResponse> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');

  const page = typeof pageParam === 'number' ? pageParam : 0;

  const token = window.sessionStorage.getItem('accessToken');
  if (!token) {
    throw new Error('No access token found');
  }

  // Build request body dynamically—omit fields if not provided
  const body: Record<string, unknown> = {};

  if (contacts && (Array.isArray(contacts) ? contacts.length > 0 : contacts.trim().length > 0)) {
    body.contacts = contacts;
  }
  if (typeof searchTerm === 'string' && searchTerm.length > 0) {
    body.searchTerm = searchTerm;
  }
  if (typeof isSubscribed !== 'undefined' && isSubscribed !== null) {
    // controller accepts boolean or "true"/"false" string; pass through as given
    body.isSubscribed = isSubscribed;
  }
  if (
    excludeUserIds &&
    (Array.isArray(excludeUserIds) ? excludeUserIds.length > 0 : excludeUserIds.trim().length > 0)
  ) {
    body.excludeUserIds = excludeUserIds;
  }

  const url = `${BASE_URL}/api/user/contacts?page=${page}&size=${size}&sort=${encodeURIComponent(
    sort
  )}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    // credentials: 'include', // enable only if your API needs cookies
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Error ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`);
  }

  return (await response.json()) as ContactResponse;
}

/* =========================
 * Hook
 * ========================= */
export function useFetchContactsInfinite(
  size: number,
  contacts: MaybeArrayOrCSV,
  searchTerm?: string,
  isSubscribed?: MaybeBooleanOrString,
  excludeUserIds?: MaybeArrayOrCSV,
  sort: string = 'username,asc'
) {
  return useInfiniteQuery<ContactResponse, Error>({
    queryKey: [
      'contacts',
      size,
      // Use stable primitives in the key
      typeof contacts === 'string' ? contacts : JSON.stringify(contacts ?? []),
      searchTerm ?? '',
      typeof isSubscribed === 'string' ? isSubscribed : isSubscribed ?? '',
      typeof excludeUserIds === 'string' ? excludeUserIds : JSON.stringify(excludeUserIds ?? []),
      sort,
    ],
    queryFn: (ctx) =>
      fetchContacts(ctx, size, contacts, searchTerm, isSubscribed, excludeUserIds, sort),
    getNextPageParam: (lastPage) => {
      const current = lastPage?.data?.pageable.pageNumber ?? 0;
      const total = lastPage?.data?.pageable.totalPages ?? 0;
      return current + 1 < total ? current + 1 : undefined;
    },
    initialPageParam: 0,
    enabled: isBrowser, // avoid sessionStorage during SSR
  });
}
