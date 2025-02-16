import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the structure of the response
interface MarkPrimaryResponse {
  success: boolean;
  data: string | null;
  errorMessage: string | null;
}

// Define the request payload
interface MarkPrimaryRequest {
  paymentMethodId: string;
}

// API function to mark a payment method as primary
async function markPrimaryPaymentMethod(
  requestData: MarkPrimaryRequest
): Promise<MarkPrimaryResponse> {
  try {
    // Retrieve the JWT token from sessionStorage instead of SecureStore
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }

    // Make the API request
    const response = await fetch('http://192.168.1.32:8080/customer/mark-primary', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, // Bearer token for authentication
        'Content-Type': 'application/json', // Set JSON content type
      },
      body: JSON.stringify(requestData), // Request payload
    });

    // Parse the response JSON
    const data = await response.json();

    // Handle HTTP errors
    if (!response.ok) {
      throw new Error(data.errorMessage || 'Failed to mark payment method as primary');
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to mark payment method as primary');
  }
}

// React Query hook for marking a payment method as primary
export function useMarkPrimaryPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestData: MarkPrimaryRequest) =>
      markPrimaryPaymentMethod(requestData),
    onSuccess: (data) => {
      if (data.success) {
        console.log('Payment method marked as primary successfully:', data.data);
        queryClient.invalidateQueries({ queryKey: ['paymentMethods'] }); // Invalidate queries to refetch updated data
      } else {
        console.error('Failed to mark payment method as primary:', data.errorMessage);
      }
    },
    onError: (error) => {
      console.error('Error marking payment method as primary:', error);
    },
  });
}
