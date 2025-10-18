// File: src/hooks/useIsProductMonitored.ts

import { useQuery } from '@tanstack/react-query';

export interface IsMonitoredPayload {
  productId: string;
  monitored: boolean;
}

export interface IsMonitoredResponse {
  success: boolean;
  data: IsMonitoredPayload | null;
  error?: string | null;
}

const BASE_URL = 'http://localhost:8080';

/**
 * Fetch "is monitored" for a given product.
 *
 * - If `token` is provided, sends Authorization: Bearer <token>
 * - Always includes credentials so cookie-based auth works too.
 */
export async function fetchIsProductMonitored(
  productId: string,
  token?: string | null
): Promise<IsMonitoredResponse> {
  if (!productId) {
    throw new Error('productId is required');
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${BASE_URL}/api/monitored-products/user/is-monitored/${encodeURIComponent(productId)}`,
    {
      method: 'GET',
      headers,
      credentials: 'include', // ← send cookies if present
    }
  );

  // Endpoint is expected to return 200 always with { productId, monitored }
  // but keep a defensive check just in case.
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errorText =
      (body && JSON.stringify(body)) || `${res.status} ${res.statusText}`;
    throw new Error(`is-monitored failed: ${errorText}`);
  }

  return {
    success: true,
    data: body as IsMonitoredPayload,
    error: null,
  };
}

/**
 * React Query hook
 * - Reads accessToken from sessionStorage (web)
 * - Falls back to cookie-based auth if no token
 */
export function useIsProductMonitored(productId: string) {
  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('accessToken')
      : null;

  return useQuery<IsMonitoredResponse, Error>({
    queryKey: ['isProductMonitored', productId, !!token],
    queryFn: () => fetchIsProductMonitored(productId, token),
    enabled: !!productId, // allow cookie-only when no token
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
