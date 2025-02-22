import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Define the structure of a discount object returned by the endpoint.
export interface Discount {
  id: string;                      // The unique identifier for the discount.
  createdAt: string;               // Timestamp for when the discount was created.
  updatedAt: string;               // Timestamp for when the discount was last updated.
  discountName: string;            // The name of the discount.
  type: 'PERCENTAGE_OFF' | 'AMOUNT_OFF';  // The type of discount.
  discountPercentage?: number | null; // The discount percentage (if applicable).
  discountAmount?: number | null;       // The discount amount in cents (if applicable).
  singleUse: boolean;              // Indicates if the discount is single-use.
  expiresAt?: string | null;       // The expiration date/time (if set).
  redeemedBy: string[];            // Array of user IDs that have redeemed the discount.
  applicableUsers: string[];       // Array of user IDs eligible for the discount.
}

// Function to call the GET endpoint that retrieves available discounts for a merchant.
async function fetchAvailableDiscounts(
  merchantId: string,
  token: string
): Promise<Discount[]> {
  const response = await axios.get<Discount[]>(
    'http://192.168.1.32:8080/api/discounts/available/merchant',
    {
      params: { merchantId },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',

      },
    }
  );

  return response.data;
}

// Custom hook that uses React Query to fetch available discounts for a given merchant.
export function useAvailableDiscounts(merchantId: string) {
  const token = sessionStorage.getItem('accessToken');

  return useQuery<Discount[], Error>({
    queryKey: ['availableDiscounts', merchantId],
    queryFn: () => {
      if (!token) {
        return Promise.reject(new Error('No access token found'));
      }
      return fetchAvailableDiscounts(merchantId, token);
    },
    enabled: Boolean(merchantId) && Boolean(token),
  });
}
