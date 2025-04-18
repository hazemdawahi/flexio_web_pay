import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Define the structure of a discount object returned by the endpoint.
export interface Discount {
  id: string;                      // The unique identifier for the discount.
  createdAt: string;               // Timestamp for when the discount was created.
  updatedAt: string;               // Timestamp for when the discount was last updated.
  merchant: any;                   // Merchant details (adjust type as needed).
  discountName: string;            // The name of the discount.
  type: 'PERCENTAGE_OFF' | 'AMOUNT_OFF';  // The type of discount.
  discountPercentage?: number | null; // The discount percentage (if applicable).
  discountAmount?: number | null;       // The discount amount in cents (if applicable).
  minimumPurchaseAmount?: number;  // Minimum purchase amount required for amount‑off discounts.
  singleUse: boolean;              // Indicates if the discount is single-use.
  expiresAt?: string | null;       // The expiration date/time (if set).
  redeemedBy: string[];            // Array of user IDs that have redeemed the discount.
  applicableUsers: string[];       // Array of user IDs eligible for the discount.
  checkout: any | null;            // Checkout information (if any).
  expiredByMerchant: boolean;      // Indicates if the discount has been expired by the merchant.
}

// Function to call the GET endpoint that retrieves available discounts for a merchant,
// filtering based on the current order amount.
async function fetchAvailableDiscounts(
  merchantId: string,
  orderAmount: number,
  token: string
): Promise<Discount[]> {
  const response = await axios.get<Discount[]>(
    'http://192.168.1.32:8080/api/discounts/available/merchant',
    {
      params: { merchantId, orderAmount },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

// Custom hook that uses React Query to fetch available discounts for a given merchant
// based on the current order amount.
export function useAvailableDiscounts(merchantId: string, orderAmount: number) {
  const token = sessionStorage.getItem('accessToken');

  return useQuery<Discount[], Error>({
    queryKey: ['availableDiscounts', merchantId, orderAmount],
    queryFn: () => {
      if (!token) {
        return Promise.reject(new Error('No access token found'));
      }
      return fetchAvailableDiscounts(merchantId, orderAmount, token);
    },
    enabled: Boolean(merchantId) && Boolean(token) && Boolean(orderAmount),
  });
}
