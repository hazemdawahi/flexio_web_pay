// src/hooks/useUserDetails.ts
import { useQuery } from '@tanstack/react-query';

// Interfaces for User Details
export interface Address {
  id: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: string; // Indicates address type (billing/shipping)
}

export interface Settings {
  id: string;
  overdraft: boolean;
  biometrics: boolean;
  paymentDue: boolean;
  purchaseComplete: boolean;
  offersSupprise: boolean;
  autoPay: boolean;
  pinCode: string | null;
  overdraftPaymentMethodId: string | null;
  planFrequency: number;
  planType: string | null;
  planLinkedMethodId: string | null;
  planAmount: number | null;
  requests: boolean;
  offsetDays: number | null;
  channelUrl: string | null;
  confirmMessage: string | null;
  csatMessage: string | null;
}

export interface UserDetails {
  id: string;
  phoneNumber: string;
  countryCode: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  username: string;
  yearlyPower: number;
  instantaneousPower: number;
  interestFreeAmount: number;
  dateOfBirth: string;
  smartPay: boolean;
  notify_Token: string | null;
  totalOwed: number;
  autoPay: boolean;
  remainingAvoidedDays: number;
  logo: string | null;
  gender: string;
  sendbirdAccessToken: string | null;
  settings: Settings;
  billingAddress: Address;
  shippingAddress: Address;
  createdAt: string;
  updatedAt: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  subscribed: boolean;
}

export interface LatestActiveCard {
  id: number;
  stripeCardId: string;
  spendingLimit: number;
  paymentFrequency: number;
  planType: 'MONTHLY' | 'BIWEEKLY' | null;
  status: 'active' | 'inactive';
  offsetStartDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserDetailsResponseData {
  user: UserDetails;
  latestActiveCard: LatestActiveCard | null;
}

export interface UserDetailsResponse {
  success: boolean;
  data: UserDetailsResponseData | null;
  error: string | null;
}

// Async function to fetch user details using the `fetch` API
export async function fetchUserDetails(token: string): Promise<UserDetailsResponse> {
  const response = await fetch('http://192.168.1.32:8080/api/user/user-details', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // Passing the token in the Authorization header
      'Content-Type': 'application/json',
    },

  });

  console.log("Response Status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: UserDetailsResponse = await response.json();
  return data;
}

// Custom hook to fetch user details using useQuery
export function useUserDetails() {
  // Retrieve the access token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  return useQuery<UserDetailsResponse, Error>({
    queryKey: ['userDetails', token], // Include token in queryKey to refetch on token change
    queryFn: () => {
      if (!token) throw new Error('No access token available');
      return fetchUserDetails(token);
    },
    enabled: !!token, // Only run the query if token is available
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
