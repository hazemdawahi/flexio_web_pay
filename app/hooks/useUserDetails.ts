// ~/hooks/useUserDetails.ts

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import {
  getAccessToken,
  authFetch,
  AuthError,
  isBrowser,
} from "~/lib/auth/apiClient";

export interface Address {
  id: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: string;
  version?: number;
}

export interface UserDetails {
  version: number;
  id: string;
  phoneNumber: string;
  countryCode: string;
  email: string;
  identityVerified: boolean;
  firstName: string;
  lastName: string;
  middleName: string | null | "";
  username: string;
  dateOfBirth: string;
  yearlyPower: number;
  instantaneousPower: number;
  creditScore: number;
  smartPay: boolean;
  marqetaCardToken: string | null;
  primaryMethod: string | null;
  primaryPlaidAccountId: string | null;
  logo: string | null;
  sendbirdAccessToken: string | null;
  sendbirdDeskCustomerId: number | null;
  channelUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastCreditUpdate: string;
  lastTwoMonthUpdatedDate: string;
  latestThreeMonthUpdatedDate: string;
  yearlyTerms: number;
  lastYearlyTermsUpdatedDate: string;
  billingAddress: Address;
  shippingAddress: Address;
  smartPayPreference: unknown | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface UserDetailsResponseData {
  user: UserDetails;
  totalOwed: number;
  interestFreeCreditAmount: number;
  remainingAvoidedDays: number;
  subscribed: boolean;
}

export interface UserDetailsResponse {
  success: boolean;
  data: UserDetailsResponseData | null;
  error: string | null;
}

export function useUserDetails() {
  const token = isBrowser ? getAccessToken() : null;
  const navigate = useNavigate();

  const query = useQuery<UserDetailsResponse, Error>({
    // FIXED: Removed token from query key (anti-pattern)
    // Query keys should only contain data dependencies, not auth state
    // Use `enabled` to control when queries run based on auth
    queryKey: ["user", "details"],
    queryFn: () =>
      authFetch<UserDetailsResponse>("/api/user/user-details"),
    enabled: !!token && isBrowser,
    // Cache user details for 10 minutes
    staleTime: 1000 * 60 * 10,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
  });

  // Handle auth error by redirecting to login
  useEffect(() => {
    if (query.error instanceof AuthError) {
      navigate("/login", { replace: true });
    }
  }, [query.error, navigate]);

  return query;
}
