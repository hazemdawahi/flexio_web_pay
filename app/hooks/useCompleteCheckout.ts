import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Define the payload structure for the complete checkout endpoint.
// This supports both a normal checkout and a split checkout.
// Fields such as checkoutToken, paymentFrequency, numberOfPayments, etc., 
// are defined based on your backend validations and the provided cURL example.
export interface CompleteCheckoutPayload {
  checkoutToken: string;             // e.g. "sample-checkout-token"
  paymentFrequency?: string;         // e.g. "MONTHLY" (must match expected enum values)
  numberOfPayments?: number;         // e.g. 1 (must be greater than zero if otherUsers is empty)
  offsetStartDate?: string;          // e.g. "2025-05-01" in ISO format
  instantAmount: number;             // Payment amount in cents, e.g. 10000
  yearlyAmount: number;              // Payment amount in cents, e.g. 5000
  selectedPaymentMethod: string;     // e.g. "CREDIT_CARD"
  superchargeDetails: {              // Array of supercharge details; can be empty
    amount: number;                // e.g. 500
    paymentMethodId: string;       // e.g. "pm_card_mastercard"
  }[];
  reference?: string;                // Optional: e.g. "order-001"
  otherUsers?: {                     // Optional field for split checkout scenarios
    userId: string;
    amount: number;
  }[];
  discountIds?: string[];            // Optional list of discount identifiers
  selfPayActive: boolean;            // Indicates whether self-pay is active; e.g. false
}

// Define the response structure for a successful complete checkout request.
export interface CompleteCheckoutResponse {
  message: string;  // e.g. "Checkout completed successfully; PaymentPlan id: PP12345"
}

// Function to call the complete checkout endpoint.
async function completeCheckout(
  payload: CompleteCheckoutPayload
): Promise<CompleteCheckoutResponse> {
  try {
    // Retrieve the access token from sessionStorage.
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }

    // Call the API with the updated endpoint URL.
    const response = await axios.post<CompleteCheckoutResponse>(
      'http://192.168.1.121:8080/api/checkout/complete',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || 'Failed to complete checkout'
    );
  }
}

// Custom hook that uses React Query's mutation for the complete checkout process.
export function useCompleteCheckout() {
  const queryClient = useQueryClient();

  return useMutation<CompleteCheckoutResponse, Error, CompleteCheckoutPayload>({
    mutationFn: (payload: CompleteCheckoutPayload) => completeCheckout(payload),
    onSuccess: () => {
      // Optionally, invalidate queries related to checkout to refresh data.
      queryClient.invalidateQueries({ queryKey: ['checkout'] });
    },
    onError: (error) => {
      console.error('Error completing checkout:', error);
    },
  });
}
