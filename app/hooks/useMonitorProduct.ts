// ~/hooks/useMonitorProduct.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

export interface MonitorProductResponse {
  success: boolean;
  data: {
    productId: string;
  } | null;
  error: string | null;
}

export function useMonitorProduct() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<MonitorProductResponse, Error, string>({
    mutationFn: (productId: string) =>
      authFetch<MonitorProductResponse>(
        `/api/monitored-products/user/monitor/${encodeURIComponent(productId)}`,
        {
          method: "POST",
          // keep empty body if your API expects JSON
          body: JSON.stringify({}),
        }
      ),
    onSuccess: (data, productId) => {
      // Refresh monitored list + this product's monitored state
      queryClient.invalidateQueries({ queryKey: ["monitoredProducts"] });
      queryClient.invalidateQueries({
        queryKey: ["isProductMonitored", productId],
      });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Error monitoring product:", error.message);
    },
  });
}
