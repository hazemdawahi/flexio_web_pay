import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@remix-run/react";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

// Define the structure of the response for detaching a payment method
interface DetachPaymentMethodResponse {
  success: boolean;
  data: string | null;
  error: string | null;
}

// Define the request parameters for detaching a payment method
interface DetachPaymentMethodParams {
  paymentMethodId: string;
}

// Function to detach the payment method from the customer (authenticated)
async function detachPaymentMethod(
  { paymentMethodId }: DetachPaymentMethodParams
): Promise<DetachPaymentMethodResponse> {
  // authFetch automatically attaches the access token and handles refresh / AuthError
  return authFetch<DetachPaymentMethodResponse>("/api/customer/detach-payment-method", {
    method: "POST",
    body: JSON.stringify({ paymentMethodId }),
  });
}

// Custom hook to use in your component
export function useDetachPaymentMethod() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<DetachPaymentMethodResponse, Error, DetachPaymentMethodParams>({
    mutationFn: (params) => detachPaymentMethod(params),
    onSuccess: () => {
      // Invalidate the 'paymentMethods' query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Error detaching payment method:", error.message);
    },
  });
}
