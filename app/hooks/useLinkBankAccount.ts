import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authFetch, AuthError } from "~/lib/auth/apiClient";

// Define the structure of the response from the link bank account API
export interface LinkBankAccountResponse {
  success: boolean;
  data: {
    message: string;
  };
  error: any | null;
}

// Authenticated function that calls the link bank accounts endpoint
async function linkBankAccounts(): Promise<LinkBankAccountResponse> {
  // authFetch will attach the access token and handle refresh / AuthError
  return authFetch<LinkBankAccountResponse>("/api/plaid/link_bank_accounts", {
    method: "POST",
    // No body required as per your API documentation
  });
}

// Custom hook to use the link bank accounts API (authenticated mutation)
export function useLinkBankAccounts() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<LinkBankAccountResponse, Error, void>({
    mutationFn: () => linkBankAccounts(), // No parameter is passed since no body is required
    onSuccess: () => {
      // Handle the successful linking of all bank accounts
      console.log("All bank accounts linked successfully");
      queryClient.invalidateQueries({ queryKey: ["linkedBankAccounts"] }); // Refresh linked bank accounts data
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] }); // Refresh payment methods
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate("/login", { replace: true });
        return;
      }
      console.error("Failed to link bank accounts:", error.message);
    },
  });
}
