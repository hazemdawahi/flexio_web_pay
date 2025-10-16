// src/hooks/usePlaidTokens.ts

import { useQuery } from '@tanstack/react-query';

// Interfaces for Plaid Tokens Response
export interface PlaidTokensData {
  hasPlaidLiabilityAccessToken: boolean;
  hasPlaidUserToken: boolean;
  hasRequiredTokens: boolean;
}

export interface PlaidTokensResponse {
  success: boolean;
  data: PlaidTokensData | null;  // now an object of flags, or null on error
  error: string | null;
}

// Async function to check if user has required Plaid tokens
export async function fetchPlaidTokensStatus(): Promise<PlaidTokensResponse> {
  try {
    // Retrieve the token from sessionStorage
    const token =
      typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

    if (!token) {
      throw new Error('No access token found');
    }

    // Call the API using the native fetch method
    const response = await fetch(
      'http://192.168.1.121:8080/api/user/has-required-plaid-tokens',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );

    // Check if the response is OK
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    // Parse the JSON response
    const json = await response.json();
    return json as PlaidTokensResponse;
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
