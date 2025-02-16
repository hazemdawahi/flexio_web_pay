import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the structure of the response from the link bank account API
export interface LinkBankAccountResponse {
  success: boolean;
  data: {
    message: string;
  };
  error: any | null;
}

// Define the function that makes the API request to link the bank accounts
async function linkBankAccounts(): Promise<LinkBankAccountResponse> {
  try {
    // Retrieve the access token from sessionStorage instead of SecureStore
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Make the POST request to link the bank accounts
    const response = await axios.post(
      'http://192.168.1.32:8080/api/plaid/link_bank_accounts', // Use the correct API URL
      {}, // No body required as per your API documentation
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
      throw new Error(`Failed to link bank accounts: ${error.response.data}`);
    } else if (error.request) {
      throw new Error('Failed to link bank accounts: No response received from the server');
    } else {
      throw new Error(`Failed to link bank accounts: ${error.message}`);
    }
  }
}

// Custom hook to use the link bank accounts API
export function useLinkBankAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkBankAccounts, // No parameter is passed since no body is required
    onSuccess: () => {
      // Handle the successful linking of all bank accounts
      console.log('All bank accounts linked successfully');
      queryClient.invalidateQueries({ queryKey: ['linkedBankAccounts'] }); // Refresh linked bank accounts data
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] }); // Refresh payment methods
    },
    onError: (error) => {
      console.error('Failed to link bank accounts:', error);
    },
  });
}
