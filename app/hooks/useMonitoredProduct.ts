// src/hooks/useMonitoredProduct.ts

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AuthError,
  authFetch,
  getAccessToken,
  isBrowser,
} from "~/lib/auth/apiClient";

export interface Price {
  id: string;
  amount: string;
  currency: string;
}

export interface MonitoredProduct {
  id: string;
  createdAt: string;
  updatedAt: string;
  productImageUrl: string;
  productName: string;
  merchantProductId: string;
  sku: string;
  price: Price;
  unitsInStock: number;
  inStock: boolean;

  // ✅ fields your page uses:
  state: string;
  monitoringCount: number;
  productUrl?: string | null;
}

// ✅ We now return the product directly, not a { success, data } wrapper
export function useMonitoredProduct(productId: string) {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<MonitoredProduct, Error>({
    queryKey: ["monitoredProduct", productId, token],
    queryFn: () =>
      authFetch<MonitoredProduct>(`/api/monitored-products/${productId}`),
    enabled: !!productId && !!token && isBrowser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
