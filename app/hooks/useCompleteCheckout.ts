import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Define the payload structure for the complete checkout endpoint.
// This supports both a normal checkout and a split checkout.
// Note: The key "checkoutToken" is used to look up the checkout.
export interface CompleteCheckoutPayload {
  checkoutToken: string; // e.g. "chk_ABC123XYZ"
  // The following fields are required for a normal checkout
  paymentFrequency?: string; // e.g. "MONTHLY" or "BIWEEKLY"
  numberOfPayments?: number;  // e.g. 12
  offsetStartDate?: string;   // e.g. "2025-03-01" in ISO format
  // For both checkout types
  instantAmount: number;      // Payment amount in cents, e.g. 20000
  yearlyAmount: number;       // Payment amount in cents, e.g. 100000
  selectedPaymentMethod: string; // e.g. "pm_card_visa"
  superchargeDetails: {
    amount: number;           // e.g. 500
    paymentMethodId: string;  // e.g. "pm_card_mastercard"
  }[];
  reference?: string;         // Optional: e.g. "order_ref_98765"
  // Optional field for split checkout
  otherUsers?: {
    userId: string;
    amount: number;
  }[];
}

// Define the response structure for a successful complete checkout request.
export interface CompleteCheckoutResponse {
  message: string; // e.g. "Checkout completed successfully; PaymentPlan id: PP12345"
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

    // Call the API. Update the endpoint URL as needed.
    const response = await axios.post<CompleteCheckoutResponse>(
      'http://192.168.1.32:8080/api/checkout/complete',
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
