// ~/hooks/useIsProductMonitored.ts

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useEffect } from "react";
 import { getAccessToken, authFetch, AuthError, isBrowser } from "~/lib/auth/apiClient";
 
export interface IsMonitoredPayload {
  productId: string;
  monitored: boolean;
}

export interface IsMonitoredResponse {
  success: boolean;
  data: IsMonitoredPayload | null;
  error?: string | null;
}

export function useIsProductMonitored(productId: string) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<IsMonitoredResponse, Error>({
    // Hierarchical key: [domain, entity, id]
    queryKey: ["products", "monitored", productId],
    queryFn: async () => {
      if (!productId) {
        throw new Error("productId is required");
      }

      try {
        const data = await authFetch<IsMonitoredPayload>(
          `/api/monitored-products/user/is-monitored/${encodeURIComponent(productId)}`
        );
        return {
          success: true,
          data,
          error: null,
        };
      } catch (err) {
        if (err instanceof AuthError) {
          throw err;
        }
        return {
          success: false,
          data: null,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    enabled: !!productId && !!token && isBrowser,
    staleTime: 1000 * 60 * 5,
    retry: false,
    // Keep previous state while checking
    placeholderData: (previousData) => previousData,
  });

  // Handle auth error
  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}