// ~/hooks/useMonitorProduct.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
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
    onSuccess: (_data, productId) => {
      // Invalidate all product monitoring queries
      // Using hierarchical key allows invalidating all related queries at once
      queryClient.invalidateQueries({ queryKey: ["products", "monitored"] });
      // Also specifically invalidate this product
      queryClient.invalidateQueries({
        queryKey: ["products", "monitored", productId],
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
