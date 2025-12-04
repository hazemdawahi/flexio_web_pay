import { useMutation } from '@tanstack/react-query';

// Define the request interface
export interface LoginRequest {
  identifier: string;
}

// Define the response interface based on the example you provided
interface LoginResponse {
  success: boolean;
  data: string;
  error: string | null;
}

// Function to send the login request with a timeout using fetch
async function loginData(loginRequest: LoginRequest): Promise<LoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

  try {
    const response = await fetch('http://localhost:8080/api/user/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginRequest),
      signal: controller.signal, // Attach the AbortController signal to fetch
      cache: 'no-store', // Prevents caching of the response
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Login failed: ${errorData}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Login request timed out');
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Create the hook using React Query's useMutation
export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: loginData,
    onSuccess: (data) => {
      console.log('Login successful:', data);
      // Handle successful login, e.g., navigate to the next step
    },
    onError: (error) => {
      console.error('Login failed:', error.message);
      // Handle login failure, e.g., show toast notification
    },
  });
}
