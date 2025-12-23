/**
 * Route Prefetching Utilities
 *
 * Provides utilities for prefetching data on route transitions.
 * This enables instant navigation by loading data ahead of time.
 *
 * @see https://reactrouter.com/start/framework/data-loading
 */

import { getQueryClient } from "./queryClient";
import {
  userDetailsOptions,
  paymentMethodsOptions,
  checkoutDetailOptions,
  smartpayPreferencesOptions,
  availableDiscountsOptions,
} from "./queryOptions";

/**
 * Prefetch user-related data for authenticated routes
 * Call this when entering the protected area
 */
export async function prefetchUserData(): Promise<void> {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(userDetailsOptions());
}

/**
 * Prefetch user details and payment methods together
 * Useful for checkout flows where both are needed
 */
export async function prefetchUserAndPaymentMethods(
  userId: string
): Promise<void> {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(userDetailsOptions()),
    queryClient.prefetchQuery(paymentMethodsOptions(userId)),
  ]);
}

/**
 * Prefetch checkout-related data
 * Call this when navigating to checkout pages
 */
export async function prefetchCheckoutData(
  checkoutToken: string
): Promise<void> {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(checkoutDetailOptions(checkoutToken));
}

/**
 * Prefetch all data needed for the payment options page
 */
export async function prefetchPaymentOptionsData(params: {
  checkoutToken: string;
  userId: string;
  merchantId?: string;
  orderAmount?: number;
}): Promise<void> {
  const queryClient = getQueryClient();

  const prefetches = [
    queryClient.prefetchQuery(checkoutDetailOptions(params.checkoutToken)),
    queryClient.prefetchQuery(paymentMethodsOptions(params.userId)),
    queryClient.prefetchQuery(smartpayPreferencesOptions()),
  ];

  // Prefetch discounts if we have merchant info
  if (params.merchantId && params.orderAmount) {
    prefetches.push(
      queryClient.prefetchQuery(
        availableDiscountsOptions(params.merchantId, params.orderAmount)
      )
    );
  }

  await Promise.all(prefetches);
}

/**
 * Ensure query data is fresh
 * Use this to check if cached data exists and is not stale
 */
export function hasValidCachedData<T>(
  queryKey: readonly unknown[]
): T | undefined {
  const queryClient = getQueryClient();
  const state = queryClient.getQueryState(queryKey);

  if (!state) return undefined;
  if (state.isInvalidated) return undefined;
  if (state.status !== "success") return undefined;

  return state.data as T;
}

/**
 * Invalidate and refetch a query
 * Use this when you need fresh data immediately
 */
export async function refetchQuery(queryKey: readonly unknown[]): Promise<void> {
  const queryClient = getQueryClient();
  await queryClient.invalidateQueries({ queryKey });
}

/**
 * Cancel any in-flight queries for a key
 * Use this on route unmount to prevent stale updates
 */
export async function cancelQuery(queryKey: readonly unknown[]): Promise<void> {
  const queryClient = getQueryClient();
  await queryClient.cancelQueries({ queryKey });
}
