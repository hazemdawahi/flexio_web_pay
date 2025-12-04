import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the structure of the response from the exchange public token API
export interface ExchangePublicTokenResponse {
  success: boolean;
  data: {
    stripe_bank_account_token: string;
  };
  error: any | null;
}

// Define the function that makes the API request to exchange the public token
async function exchangePublicToken(publicToken: string): Promise<ExchangePublicTokenResponse> {
  try {
    // Retrieve the access token from sessionStorage instead of SecureStore
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Make the POST request to exchange the public token
    const response = await axios.post(
      'http://localhost:8080/api/plaid/exchange_stripe_public_token',
      { publicToken }, // Send the publicToken in the body
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // Pass the access token as a Bearer token
        },
      }
    );

    return response.data; // Return the response data
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Failed to exchange public token: ${error.response.data}`);
    } else if (error.request) {
      throw new Error('Failed to exchange public token: No response received from the server');
    } else {
      throw new Error(`Failed to exchange public token: ${error.message}`);
    }
  }
}

// Custom hook to use the exchange public token API
export function useExchangePublicToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (publicToken: string) => exchangePublicToken(publicToken),
    onSuccess: (data: ExchangePublicTokenResponse) => {
      // Handle the successful exchange of the public token
      console.log('Public token exchanged successfully:', data.data.stripe_bank_account_token);
      // Invalidate any related queries, like bank account data or account details
      queryClient.invalidateQueries({ queryKey: ['accountDetails'] });
    },
    onError: (error) => {
      console.error('Failed to exchange public token:', error);
    },
  });
}
