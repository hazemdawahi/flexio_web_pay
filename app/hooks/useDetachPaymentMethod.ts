import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Define the structure of the request and response for detaching a payment method
interface DetachPaymentMethodResponse {
  success: boolean;
  data: string | null;
  error: string | null;
}

// Define the request parameters for detaching a payment method
interface DetachPaymentMethodParams {
  paymentMethodId: string;
}

// Function to detach the payment method from the customer
async function detachPaymentMethod({ paymentMethodId }: DetachPaymentMethodParams): Promise<DetachPaymentMethodResponse> {
  try {
    // Retrieve the JWT token from sessionStorage instead of SecureStore
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }
    
    console.log("paymentMethodId", paymentMethodId);
    
    // Make the API request to detach the payment method from the customer
    const response = await axios.post<DetachPaymentMethodResponse>(
      'http://localhost:8080/customer/detach-payment-method',
      { paymentMethodId }, // Send the payment method ID in the request body
      {
        headers: {
          'Authorization': `Bearer ${token}`, // Pass the JWT token as a Bearer token
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to detach payment method');
  }
}

// Custom hook to use in your component
export function useDetachPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DetachPaymentMethodParams) => detachPaymentMethod(params),
    onSuccess: () => {
      // Invalidate the 'paymentMethods' query to refresh the list after successfully detaching the payment method
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
    },
    onError: (error) => {
      console.error('Error detaching payment method:', error);
    },
  });
}
