import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the structure of the response from the create Plaid link token API
export interface CreatePlaidLinkTokenResponse {
  success: boolean;
  data: {
    link_token: string;
  };
  error: any | null;
}

// Function to fetch the link token from the API
async function createPlaidLinkToken(): Promise<CreatePlaidLinkTokenResponse> {
  try {
    // Retrieve the access token from sessionStorage instead of SecureStore
    const accessToken = sessionStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await axios.post(
      'http://192.168.1.32:8080/api/plaid/create_web_link_token_stripe',
      {}, // No body required as the userId is extracted from the JWT
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // Pass the access token as a Bearer token
        },
      }
    );
    console.log("response", response.data);

    return response.data; // Return the entire response
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Failed to create link token: ${error.response.data}`);
    } else if (error.request) {
      throw new Error('Failed to create link token: No response received from the server');
    } else {
      throw new Error(`Failed to create link token: ${error.message}`);
    }
  }
}

// Custom hook to use the create Plaid link token API
export function useCreatePlaidLinkToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlaidLinkToken,
    onSuccess: () => {
      // Handle the successful generation of the Plaid link token
      console.log('Plaid link token created successfully');
      queryClient.invalidateQueries({ queryKey: ['plaidLinkToken'] });
    },
    onError: (error) => {
      console.error('Failed to create Plaid link token:', error);
    },
  });
}
