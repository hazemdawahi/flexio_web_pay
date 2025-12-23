/**
 * Query Options Factory
 *
 * Centralized query option definitions using the queryOptions helper.
 * This allows sharing queryKey and queryFn between useQuery, prefetching,
 * and cache manipulation.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-options
 */

import { queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { STALE_TIMES, GC_TIMES } from "./queryClient";
import {
  authFetch,
  isBrowser,
  getAccessToken,
} from "~/lib/auth/apiClient";
import type { Frequency } from "~/hooks/useFinancialCalendarPlan";

// ========================
// Type Definitions
// ========================

// Import types from existing hooks (you may want to centralize these)
import type { UserDetailsResponse } from "~/hooks/useUserDetails";
import type { PaymentMethodsResponse, PaymentMethod } from "~/hooks/usePaymentMethods";
import type { CheckoutDetailResponse } from "~/hooks/useCheckoutDetail";
import type { SmartpayDetailedResponse } from "~/hooks/useSmartpayDetailedPlan";

// ========================
// Helper Functions
// ========================

/**
 * Check if user is authenticated (has token)
 */
function isAuthenticated(): boolean {
  return isBrowser && !!getAccessToken();
}

// ========================
// User Query Options
// ========================

/**
 * Options for fetching current user details
 *
 * @example
 * // In component
 * const { data } = useQuery(userDetailsOptions())
 *
 * // For prefetching
 * queryClient.prefetchQuery(userDetailsOptions())
 *
 * // For cache manipulation
 * queryClient.setQueryData(userDetailsOptions().queryKey, newData)
 */
export function userDetailsOptions() {
  return queryOptions({
    queryKey: queryKeys.user.details(),
    queryFn: () => authFetch<UserDetailsResponse>("/api/user/user-details"),
    enabled: isAuthenticated(),
    staleTime: STALE_TIMES.USER,
  });
}

/**
 * Options for fetching multiple user details
 */
export function multipleUserDetailsOptions(userIds: string[]) {
  return queryOptions({
    queryKey: queryKeys.user.multiple(userIds),
    queryFn: async () => {
      const response = await authFetch<{ success: boolean; data: unknown[] }>(
        "/api/user/users-by-ids",
        {
          method: "POST",
          body: JSON.stringify({ userIds }),
        }
      );
      return response;
    },
    enabled: isAuthenticated() && userIds.length > 0,
    staleTime: STALE_TIMES.USER,
  });
}

// ========================
// Payment Methods Query Options
// ========================

/**
 * Options for fetching user's payment methods
 */
export function paymentMethodsOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.paymentMethods.byUser(userId ?? ""),
    queryFn: async (): Promise<PaymentMethod[]> => {
      const json = await authFetch<PaymentMethodsResponse>(
        `/customer/payment-methods?t=${Date.now()}`
      );

      if (!json?.success) {
        throw new Error(
          `Payment methods API error: ${json?.error ?? json?.data?.error ?? "unknown"}`
        );
      }

      return json.data?.data ?? [];
    },
    enabled: isAuthenticated() && !!userId,
    staleTime: STALE_TIMES.PAYMENT_METHODS,
    // Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  });
}

// ========================
// Checkout Query Options
// ========================

/**
 * Options for fetching checkout details by token
 */
export function checkoutDetailOptions(checkoutToken: string) {
  return queryOptions({
    queryKey: queryKeys.checkout.detail(checkoutToken),
    queryFn: () =>
      authFetch<CheckoutDetailResponse>(
        `/api/checkout/details-by-token/${checkoutToken}`
      ),
    enabled: isAuthenticated() && !!checkoutToken,
    staleTime: STALE_TIMES.CHECKOUT,
  });
}

// ========================
// Merchant Query Options
// ========================

export interface MerchantDetailResponse {
  success: boolean;
  data: {
    id: string;
    displayName: string;
    displayLogo: string;
    configuration?: unknown;
    [key: string]: unknown;
  } | null;
  error: string | null;
}

/**
 * Options for fetching merchant details
 */
export function merchantDetailOptions(merchantId: string) {
  return queryOptions({
    queryKey: queryKeys.merchant.detail(merchantId),
    queryFn: () =>
      authFetch<MerchantDetailResponse>(`/api/merchant/details/${merchantId}`),
    enabled: isAuthenticated() && !!merchantId,
    staleTime: STALE_TIMES.DEFAULT,
  });
}

// ========================
// Credit Accounts Query Options
// ========================

export interface CreditAccountsResponse {
  success: boolean;
  data: unknown[];
  error: string | null;
}

/**
 * Options for fetching user's credit accounts
 */
export function creditAccountsOptions() {
  return queryOptions({
    queryKey: queryKeys.creditAccounts.list(),
    queryFn: () => authFetch<CreditAccountsResponse>("/api/credit/accounts"),
    enabled: isAuthenticated(),
    staleTime: STALE_TIMES.CREDIT_ACCOUNTS,
    // Refetch on window focus since this is sensitive financial data
    refetchOnWindowFocus: true,
  });
}

// ========================
// SmartPay Query Options
// ========================

export interface SmartpayPlanResponse {
  success: boolean;
  data: unknown;
  error: string | null;
}

/**
 * Options for fetching SmartPay plan for a price
 */
export function smartpayPlanOptions(price: number) {
  return queryOptions({
    queryKey: queryKeys.smartpay.plan(price),
    queryFn: () =>
      authFetch<SmartpayPlanResponse>(`/api/smartpay/plan?price=${price}`),
    enabled: isAuthenticated() && price > 0,
    staleTime: STALE_TIMES.SMARTPAY,
    retry: 3, // More retries for SmartPay calculations
  });
}

/**
 * Options for fetching detailed SmartPay plan
 */
export function smartpayDetailedPlanOptions(params: {
  price: number;
  frequency: Frequency;
  instantaneous: boolean;
  yearly: boolean;
  interestFreeTotal: number;
}) {
  const { price, frequency, instantaneous, yearly, interestFreeTotal } = params;

  return queryOptions({
    queryKey: queryKeys.smartpay.detailedPlan(params),
    queryFn: () => {
      const searchParams = new URLSearchParams({
        price: String(price),
        frequency,
        instantaneous: String(instantaneous),
        yearly: String(yearly),
        interestFreeTotal: String(interestFreeTotal),
      });

      return authFetch<SmartpayDetailedResponse>(
        `/api/smartpay/plan?${searchParams.toString()}`
      );
    },
    enabled: isAuthenticated() && price > 0,
    staleTime: STALE_TIMES.SMARTPAY,
    retry: 3,
  });
}

/**
 * Options for fetching SmartPay incomes
 */
export function smartpayIncomesOptions() {
  return queryOptions({
    queryKey: queryKeys.smartpay.incomes(),
    queryFn: () => authFetch<SmartpayPlanResponse>("/api/smartpay/incomes"),
    enabled: isAuthenticated(),
    staleTime: STALE_TIMES.SMARTPAY,
  });
}

/**
 * Options for fetching SmartPay preferences
 */
export function smartpayPreferencesOptions() {
  return queryOptions({
    queryKey: queryKeys.smartpay.preferences(),
    queryFn: () =>
      authFetch<SmartpayPlanResponse>("/api/smartpay/preferences/me"),
    enabled: isAuthenticated(),
    staleTime: STALE_TIMES.SMARTPAY,
  });
}

// ========================
// Discounts Query Options
// ========================

export interface AvailableDiscountsResponse {
  success: boolean;
  data: Array<{
    id: string;
    discountName: string;
    type: string;
    discountPercentage?: number;
    discountAmount?: number;
    [key: string]: unknown;
  }>;
  error: string | null;
}

/**
 * Options for fetching available discounts
 */
export function availableDiscountsOptions(merchantId: string, orderAmount: number) {
  return queryOptions({
    queryKey: queryKeys.discounts.available(merchantId, orderAmount),
    queryFn: () =>
      authFetch<AvailableDiscountsResponse>(
        `/api/discounts/available?merchantId=${merchantId}&orderAmount=${orderAmount}`
      ),
    enabled: isAuthenticated() && !!merchantId && orderAmount > 0,
    staleTime: STALE_TIMES.DISCOUNTS,
  });
}

// ========================
// Product Monitoring Query Options
// ========================

export interface IsProductMonitoredResponse {
  success: boolean;
  data: { isMonitored: boolean };
  error: string | null;
}

/**
 * Options for checking if a product is monitored
 */
export function isProductMonitoredOptions(productId: string) {
  return queryOptions({
    queryKey: queryKeys.products.monitored.isMonitored(productId),
    queryFn: () =>
      authFetch<IsProductMonitoredResponse>(
        `/api/products/is-monitored/${productId}`
      ),
    enabled: isAuthenticated() && !!productId,
    staleTime: STALE_TIMES.DEFAULT,
  });
}

// ========================
// Contacts Infinite Query Options
// ========================

interface ContactItem {
  phoneNumber: string;
  logo: string | null;
  id: string;
  username: string;
  isSubscribed: boolean;
}

interface PageableMeta {
  pageNumber: number;
  totalPages: number;
}

interface ContactResponse {
  success: boolean;
  data: {
    content: ContactItem[];
    pageable: PageableMeta;
    last: boolean;
  } | null;
  error: string | null;
}

/**
 * Options for infinite contacts query
 */
export function contactsInfiniteOptions(params: {
  size: number;
  contacts?: string | string[];
  searchTerm?: string;
  isSubscribed?: boolean | string;
  excludeUserIds?: string | string[];
  sort?: string;
}) {
  const {
    size,
    contacts,
    searchTerm,
    isSubscribed,
    excludeUserIds,
    sort = "username,asc",
  } = params;

  return infiniteQueryOptions({
    queryKey: queryKeys.user.contacts.infinite({
      size,
      contacts,
      searchTerm,
      isSubscribed,
      excludeUserIds,
      sort,
    }),
    queryFn: async ({ pageParam }) => {
      const body: Record<string, unknown> = {};

      if (contacts && (Array.isArray(contacts) ? contacts.length > 0 : contacts.trim().length > 0)) {
        body.contacts = contacts;
      }
      if (typeof searchTerm === "string" && searchTerm.length > 0) {
        body.searchTerm = searchTerm;
      }
      if (typeof isSubscribed !== "undefined" && isSubscribed !== null) {
        body.isSubscribed = isSubscribed;
      }
      if (excludeUserIds && (Array.isArray(excludeUserIds) ? excludeUserIds.length > 0 : excludeUserIds.trim().length > 0)) {
        body.excludeUserIds = excludeUserIds;
      }

      const url = `/api/user/contacts?page=${pageParam}&size=${size}&sort=${encodeURIComponent(sort)}`;

      return authFetch<ContactResponse>(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    getNextPageParam: (lastPage) => {
      const current = lastPage?.data?.pageable.pageNumber ?? 0;
      const total = lastPage?.data?.pageable.totalPages ?? 0;
      return current + 1 < total ? current + 1 : undefined;
    },
    initialPageParam: 0,
    enabled: isBrowser && isAuthenticated(),
    staleTime: STALE_TIMES.CONTACTS,
    // Keep up to 3 pages in cache for infinite queries
    maxPages: 3,
  });
}
