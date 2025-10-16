import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Define the structure of the request and response for attaching a payment method
interface AttachPaymentMethodResponse {
  success: boolean;
  data: string | null;
  error: string | null;
}

// Define the request parameters for attaching a payment method
interface AttachPaymentMethodParams {
  paymentMethodId: string;
}

// Function to attach the payment method to the customer
async function attachPaymentMethod({ paymentMethodId }: AttachPaymentMethodParams): Promise<AttachPaymentMethodResponse> {
  try {
    // Retrieve the JWT token from sessionStorage instead of SecureStore
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }

    // Make the API request to attach the payment method to the customer
    const response = await axios.post<AttachPaymentMethodResponse>(
      'http://192.168.1.121:8080/customer/attach-payment-method',
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
    throw new Error(error.response?.data?.error || 'Failed to attach payment method');
  }
}

// Custom hook to use in your component
export function useAttachPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AttachPaymentMethodParams) => attachPaymentMethod(params),
    onSuccess: () => {
      // Invalidate the 'paymentMethods' query to refresh the list after successfully attaching the payment method
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
    },
    onError: (error) => {
      console.error('Error attaching payment method:', error);
    },
  });
}
