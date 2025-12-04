// src/hooks/useMonitoredProduct.ts

import { useQuery } from '@tanstack/react-query';

export interface Price {
  id: string;
  amount: string;
  currency: string;
}

export interface MonitoredProduct {
  id: string;
  createdAt: string;
  updatedAt: string;
  productImageUrl: string;
  productName: string;
  merchantProductId: string;
  sku: string;
  price: Price;
  unitsInStock: number;
  inStock: boolean;
}

export interface MonitoredProductResponse {
  success: boolean;
  data: MonitoredProduct | null;
  error?: string | null;
}

// Fetch monitored product details by product id
async function fetchMonitoredProduct(productId: string, token: string): Promise<MonitoredProductResponse> {
  const response = await fetch(`http://localhost:8080/api/monitored-products/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`, // Pass the access token in the header
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Assuming the API returns the product details directly
  const res = await response.json();

  return {
    success: true,
    data: res,
    error: null,
  };
}

// Custom hook to fetch monitored product details using react-query
export function useMonitoredProduct(productId: string) {
  // Retrieve the access token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<MonitoredProductResponse, Error>({
    queryKey: ['monitoredProduct', productId, token],
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchMonitoredProduct(productId, token);
    },
    enabled: !!productId && !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
