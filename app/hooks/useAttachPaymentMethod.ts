import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

// Define the structure of the response for attaching a payment method
interface AttachPaymentMethodResponse {
  success: boolean;
  data: {
    id: string;
    type: string;
    [key: string]: unknown;
  } | null;
  error: string | null;
}

// Define the request parameters for attaching a payment method
interface AttachPaymentMethodParams {
  paymentMethodId: string;
}

// Function to attach the payment method to the customer (authenticated)
async function attachPaymentMethod(
  { paymentMethodId }: AttachPaymentMethodParams
): Promise<AttachPaymentMethodResponse> {
  // authFetch automatically attaches the access token and handles refresh / AuthError
  return authFetch<AttachPaymentMethodResponse>("/api/customer/attach-payment-method", {
    method: "POST",
    body: JSON.stringify({ paymentMethodId }),
  });
}

// Custom hook to use in your component
export function useAttachPaymentMethod() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<AttachPaymentMethodResponse, Error, AttachPaymentMethodParams>({
    mutationFn: (params) => attachPaymentMethod(params),
    onSuccess: () => {
      // Invalidate the 'paymentMethods' query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Error attaching payment method:", error.message);
    },
  });
}
