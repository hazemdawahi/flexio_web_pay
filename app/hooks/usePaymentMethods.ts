// src/hooks/usePaymentMethods.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Interfaces for Payment Methods

export interface UsBankAccount {
  last4: string;
  account_type: string;
  account_holder_type: string;
  bank_name: string;
  routing_number: string;
  primary: boolean;
}

export interface Card {
  last4: string;
  country: string;
  funding: string;
  exp_month: number;
  exp_year: number;
  brand: string;
  primary: boolean;
}

export interface PaymentMethod {
  created: number;
  id: string;
  type: 'us_bank_account' | 'card';
  card?: Card;
  usBankAccount?: UsBankAccount;
}

export interface PaymentMethodsResponseData {
  data: PaymentMethod[];
  success: boolean;
  error: any;
}

export interface PaymentMethodsResponse {
  success: boolean;
  data: PaymentMethodsResponseData;
  error: any;
}

// Async function to fetch payment methods from the API
async function fetchPaymentMethods(token: string): Promise<PaymentMethodsResponse> {
  const response = await axios.get<PaymentMethodsResponse>(
    'http://192.168.1.32:8080/customer/payment-methods',
    {
      headers: {
        Authorization: `Bearer ${token}`, // Passing the token in the Authorization header
      },
    }
  );

  return response.data;
}

// Custom hook to fetch payment methods using useQuery
export function usePaymentMethods() {
  // Retrieve the access token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<PaymentMethodsResponse, Error>({
    queryKey: ['paymentMethods'],
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchPaymentMethods(token);
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
