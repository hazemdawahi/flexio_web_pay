import { useQuery } from '@tanstack/react-query';

// Interface for Address
interface Address {
  id: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: string; // Indicates address type (billing/shipping)
}

// Interface for Settings
interface Settings {
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
  requests: boolean; // New field for requests feature
  offsetDays: number | null;
}

// Interface for User Details
interface UserDetails {
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
  dateOfBirth: string;
  autoPay: boolean;
  settings: Settings;
  billingAddress: Address;
  shippingAddress: Address;
  createdAt: string;
  updatedAt: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  subscribed: boolean;
  logo: string | null;
}

// Interface for Latest Active Card
interface LatestActiveCard {
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

// Response interface
interface UserDetailsResponse {
  success: boolean;
  data: Array<{
    user: UserDetails;
    latestActiveCard: LatestActiveCard | null;
  }> | null;
  error: string | null;
}

// Async function to fetch multiple user details by POST request
async function fetchMultipleUserDetails(userIds: string[]): Promise<UserDetailsResponse> {
  try {
    // Retrieve the access token from sessionStorage
    const token = sessionStorage.getItem('accessToken');

    if (!token) {
      throw new Error('No access token found');
    }

    const response = await fetch('http://192.168.1.121:8080/api/user/user-details', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userIds),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as UserDetailsResponse;
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: error.message || 'Failed to fetch user details',
    };
  }
}

// Custom hook to fetch multiple user details using useQuery
export function useFetchMultipleUserDetails(userIds: string[]) {
  return useQuery<UserDetailsResponse, Error>({
    queryKey: ['fetchMultipleUserDetails', userIds],
    queryFn: () => fetchMultipleUserDetails(userIds),
    enabled: userIds.length > 0, // Only runs if userIds is provided
  });
}
