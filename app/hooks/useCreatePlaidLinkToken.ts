import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { authFetch, AuthError } from '~/lib/auth/apiClient';

// Define the structure of the response from the create Plaid link token API
export interface CreatePlaidLinkTokenResponse {
  success: boolean;
  data: {
    link_token: string;
  };
  error: any | null;
}

// Function to fetch the link token from the API (using authFetch)
async function createPlaidLinkToken(): Promise<CreatePlaidLinkTokenResponse> {
  try {
    // No body required as the userId is extracted from the JWT
    const response = await authFetch<CreatePlaidLinkTokenResponse>(
      '/api/plaid/create_web_link_token_stripe',
      {
        method: 'POST',
        body: JSON.stringify({}), // keep explicit empty JSON body as before
      }
    );

    console.log('response', response);
    return response; // Return the entire response
  } catch (error: any) {
    // Let AuthError bubble up so the hook can redirect on 401
    if (error instanceof AuthError) {
      throw error;
    }

    const baseMessage = 'Failed to create Plaid link token';
    if (error?.response) {
      throw new Error(`${baseMessage}: ${error.response.data ?? 'Unknown server error'}`);
    } else if (error?.request) {
      throw new Error(`${baseMessage}: No response received from the server`);
    } else {
      throw new Error(`${baseMessage}: ${error?.message ?? 'Unknown error'}`);
    }
  }
}

// Custom hook to use the create Plaid link token API
export function useCreatePlaidLinkToken() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<CreatePlaidLinkTokenResponse, Error, void>({
    mutationFn: () => createPlaidLinkToken(),
    onSuccess: () => {
      // Handle the successful generation of the Plaid link token
      console.log('Plaid link token created successfully');
      queryClient.invalidateQueries({ queryKey: ['plaidLinkToken'] });
    },
    onError: (error) => {
      if (error instanceof AuthError) {
        navigate('/login', { replace: true });
        return;
      }
      console.error('Failed to create Plaid link token:', error);
    },
  });
}
