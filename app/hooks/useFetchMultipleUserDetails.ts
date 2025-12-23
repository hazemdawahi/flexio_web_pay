import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  authFetch,
  AuthError,
  isBrowser,
  getAccessToken,
} from "~/lib/auth/apiClient";

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
  planType: "MONTHLY" | "BIWEEKLY" | null;
  status: "active" | "inactive";
  offsetStartDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Response interface
interface UserDetailsResponse {
  success: boolean;
  data:
    | Array<{
        user: UserDetails;
        latestActiveCard: LatestActiveCard | null;
      }>
    | null;
  error: string | null;
}

// Async function to fetch multiple user details by POST request (authenticated)
async function fetchMultipleUserDetails(
  userIds: string[]
): Promise<UserDetailsResponse> {
  // authFetch handles attaching the token and throwing AuthError on 401
  return authFetch<UserDetailsResponse>("/api/user/user-details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userIds),
  });
}

// Custom hook to fetch multiple user details using useQuery
export function useFetchMultipleUserDetails(userIds: string[]) {
  const navigate = useNavigate();
  const token = isBrowser ? getAccessToken() : null;

  const query = useQuery<UserDetailsResponse, Error>({
    queryKey: ["fetchMultipleUserDetails", userIds],
    queryFn: () => fetchMultipleUserDetails(userIds),
    enabled: userIds.length > 0 && !!token && isBrowser, // Only runs if userIds + token are present and we're in the browser
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
