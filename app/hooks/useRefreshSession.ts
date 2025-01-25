// src/hooks/useRefreshSession.ts

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Define the response interface
export interface RefreshResponseData {
  success: boolean;
  data?: {
    accessToken: string;
    inapp?: boolean;
  };
  error?: string;
}

// Function to perform the refresh session request with axios
async function refreshSession(): Promise<RefreshResponseData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

  try {
    const response = await axios.get<RefreshResponseData>('http://192.168.1.32:8080/api/user/refresh', {
      headers: {
        'Accept': 'application/json',
      },
      withCredentials: true, // Ensure cookies are sent with the request
      signal: controller.signal,
    });

    return response.data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Refresh request timed out');
    } else if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Refresh failed: ${error.response.data.error}`);
    } else {
      throw new Error('Refresh failed');
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Create the custom hook using React Query's useMutation
export function useRefreshSession() {
  return useMutation<RefreshResponseData, Error, void>({
    mutationFn: refreshSession,
  });
}
