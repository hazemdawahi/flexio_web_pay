import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

// Define the structure of the response from the exchange public token API
export interface ExchangePublicTokenResponse {
  success: boolean;
  data: {
    stripe_bank_account_token: string;
  };
  error: any | null;
}

// Authenticated helper that calls the Plaid exchange endpoint
async function exchangePublicToken(
  publicToken: string
): Promise<ExchangePublicTokenResponse> {
  // authFetch automatically attaches the access token and handles refresh/AuthError
  return authFetch<ExchangePublicTokenResponse>(
    "/api/plaid/exchange_stripe_public_token",
    {
      method: "POST",
      body: JSON.stringify({ publicToken }), // Send the publicToken in the body
    }
  );
}

// Custom hook to use the exchange public token API (authenticated mutation)
export function useExchangePublicToken() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<ExchangePublicTokenResponse, Error, string>({
    mutationFn: (publicToken: string) => exchangePublicToken(publicToken),
    onSuccess: (data) => {
      // Handle the successful exchange of the public token
      console.log(
        "Public token exchanged successfully:",
        data.data.stripe_bank_account_token
      );
      // Invalidate any related queries, like bank account data or account details
      queryClient.invalidateQueries({ queryKey: ["accountDetails"] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Failed to exchange public token:", error.message);
    },
  });
}
