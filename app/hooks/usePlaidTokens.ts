import { useQuery } from '@tanstack/react-query';

// Interface for Plaid Tokens Response
export interface PlaidTokensResponse {
  success: boolean;
  data: boolean | null; // True if all tokens are present, false if missing, null on error
  error: string | null;
}

// Async function to check if user has required Plaid tokens
export async function fetchPlaidTokensStatus(): Promise<PlaidTokensResponse> {
  try {
    // Retrieve the token from sessionStorage
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

    if (!token) {
      throw new Error('No access token found');
    }

    // Call the API using the native fetch method
    const response = await fetch('http://192.168.1.32:8080/api/user/has-required-plaid-tokens', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`, // Passing the token in the Authorization header
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    // Check if the response is OK
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    // Parse the JSON response
    const data = await response.json();

    return data as PlaidTokensResponse;
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: error.message || 'Failed to check Plaid tokens',
    };
  }
}

// Custom hook to fetch Plaid tokens status using useQuery
export function usePlaidTokensStatus() {
  return useQuery<PlaidTokensResponse, Error>({
    queryKey: ['plaidTokensStatus'],
    queryFn: fetchPlaidTokensStatus,
  });
}
