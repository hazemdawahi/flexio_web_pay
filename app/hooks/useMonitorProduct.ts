import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Define the response structure for the monitor product endpoint.
export interface MonitorProductResponse {
  productId: string; // e.g. "12345"
}

// Function to call the monitor product endpoint.
// The productId is embedded in the URL.
async function monitorProduct(productId: string): Promise<MonitorProductResponse> {
  // Retrieve the access token from sessionStorage.
  const token = sessionStorage.getItem('accessToken');
  if (!token) {
    throw new Error('No access token found');
  }

  // Construct the URL using the provided productId.
  const url = `http://localhost:8080/api/monitored-products/user/monitor/${productId}`;

  // Call the API. Since the endpoint does not require a request body, we pass an empty object.
  const response = await axios.post<MonitorProductResponse>(
    url,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.data;
}

// Custom hook that uses React Query's mutation for monitoring a product.
export function useMonitorProduct() {
  const queryClient = useQueryClient();

  return useMutation<MonitorProductResponse, Error, string>({
    // The mutation function accepts a productId as its input.
    mutationFn: monitorProduct,
    onSuccess: () => {
      // Optionally, invalidate queries related to monitored products to refresh data.
      queryClient.invalidateQueries({ queryKey: ['monitoredProducts'] });
    },
    onError: (error) => {
      console.error('Error monitoring product:', error);
    },
  });
}
