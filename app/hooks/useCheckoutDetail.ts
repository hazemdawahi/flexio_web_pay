// src/hooks/useCheckoutDetail.ts
import { useQuery } from '@tanstack/react-query';

export interface Amount {
  id: string;
  amount: string; // The API returns amount as a string (e.g., "10000")
  currency: string;
  // Optional property based on the sample response
  hibernateLazyInitializer?: Record<string, unknown>;
}

export interface CheckoutDetail {
  id: string;
  redirectCheckoutUrl: string | null;
  token: string;
  reference: string;
  sandbox: boolean;
  status: string;
  offsetStartDate: string | null;
  paymentFrequency: string;
  numberOfPayments: number;
  totalAmount: Amount;
  expires: string;
  state: string | null;
  createdAt: string;
  updatedAt: string;
  user: any; // Adjust this type as needed if user data becomes available
}

export interface CheckoutDetailResponse {
  checkout: CheckoutDetail;
  remainingRefund: number;
  remainingCapture: number;
}

// Fetch checkout details by token (using the token in the URL)
async function fetchCheckoutDetail(checkoutToken: string, accessToken: string): Promise<CheckoutDetailResponse> {
  const response = await fetch(
    `http://192.168.1.32:8080/api/checkout/details-by-token/${checkoutToken}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: CheckoutDetailResponse = await response.json();
  return data;
}

// Custom hook to fetch checkout detail using useQuery
export function useCheckoutDetail(checkoutToken: string) {
  // Retrieve the access token from sessionStorage
  const accessToken = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<CheckoutDetailResponse, Error>({
    queryKey: ['checkoutDetail', checkoutToken],
    queryFn: () => {
      if (!accessToken) throw new Error('No access token available');
      return fetchCheckoutDetail(checkoutToken, accessToken);
    },
    enabled: !!checkoutToken && !!accessToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
