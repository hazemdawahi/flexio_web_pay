// src/hooks/useVerifyLogin.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the request interface
export interface VerifyLoginRequest {
  identifier: string;
  otp: string;
}

// Define the response interface
export interface VerifyLoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
  };
  error?: string;
}

// Function to send the verify login request with fetch
async function verifyLoginData(verifyRequest: VerifyLoginRequest): Promise<VerifyLoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

  try {
    const response = await fetch('http://192.168.1.121:8080/api/user/verify/login', { // Adjust the endpoint as needed
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyRequest),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'include', // Ensure cookies are included in the request
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Verification failed: ${errorData.error}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Verification request timed out');
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Create the custom hook using React Query's useMutation
export function useVerifyLogin() {
  return useMutation<VerifyLoginResponse, Error, VerifyLoginRequest>({
    mutationFn: verifyLoginData,
    onSuccess: (data) => {
      console.log('Verification successful:', data);

      // Since HttpOnly cookies are not accessible via JavaScript,
      // you cannot log them directly. However, you can confirm their presence
      // by checking the network response in your browser's developer tools.

      // Example: Log a message indicating that the server should have set the HttpOnly cookie
      console.log('HttpOnly cookie should be set by the server.');
    },
    onError: (error) => {
      console.error('Verification failed:', error.message);
      // Optionally, handle the error by displaying a notification or redirecting the user
    },
  });
}
