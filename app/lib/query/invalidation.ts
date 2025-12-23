/**
 * Query Invalidation Utilities
 *
 * Centralized invalidation patterns for consistent cache management.
 * These utilities help maintain data consistency after mutations.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-invalidation
 */

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/**
 * Invalidation patterns for different operations.
 * Each function returns the query keys to invalidate.
 */
export const invalidationPatterns = {
  /**
   * After completing a checkout, invalidate related queries
   */
  afterCheckoutComplete: () => [
    queryKeys.checkout.all,
    queryKeys.paymentMethods.all,
    queryKeys.creditAccounts.all,
    queryKeys.user.details(),
  ],

  /**
   * After payment method changes (add, remove, update)
   */
  afterPaymentMethodChange: () => [
    queryKeys.paymentMethods.all,
    queryKeys.creditAccounts.all,
  ],

  /**
   * After linking a bank account
   */
  afterBankAccountLink: () => [
    queryKeys.paymentMethods.all,
    queryKeys.plaid.all,
  ],

  /**
   * After monitoring a product
   */
  afterProductMonitor: (productId: string) => [
    queryKeys.products.monitored.all(),
    queryKeys.products.monitored.isMonitored(productId),
  ],

  /**
   * After SmartPay preferences change
   */
  afterSmartpayPreferencesChange: () => [
    queryKeys.smartpay.preferences(),
    queryKeys.smartpay.all,
  ],

  /**
   * After unified commerce operation (based on operation type)
   */
  afterUnifiedCommerceOperation: (operationType: string) => {
    // Base invalidations for all operations
    const baseKeys = [queryKeys.commerce.all];

    // Operation-specific invalidations
    switch (operationType) {
      case "CREATE_VIRTUAL_CARD":
      case "DELETE_VIRTUAL_CARD":
        return [...baseKeys, queryKeys.commerce.virtualCards()];

      case "CREATE_BNPL_CARD":
        return [...baseKeys, queryKeys.commerce.bnplCards()];

      case "SEND_PAYMENT":
        return [
          ...baseKeys,
          queryKeys.commerce.sends(),
          queryKeys.commerce.payments(),
          queryKeys.paymentMethods.all,
        ];

      case "REQUEST_PAYMENT":
        return [...baseKeys, queryKeys.commerce.requests()];

      case "CHECKOUT":
        return [
          ...baseKeys,
          queryKeys.checkout.all,
          queryKeys.commerce.checkouts(),
        ];

      case "SOTERIA_PAYMENT":
        return [
          ...baseKeys,
          queryKeys.commerce.soteriaPayments(),
          queryKeys.commerce.payments(),
        ];

      default:
        // Fallback: invalidate all commerce queries
        return baseKeys;
    }
  },

  /**
   * After user logout - clear everything
   */
  onLogout: () => [
    // Invalidate all domains
    queryKeys.user.all,
    queryKeys.checkout.all,
    queryKeys.paymentMethods.all,
    queryKeys.creditAccounts.all,
    queryKeys.smartpay.all,
    queryKeys.discounts.all,
    queryKeys.products.all,
    queryKeys.commerce.all,
    queryKeys.plaid.all,
    queryKeys.merchant.all,
    queryKeys.paymentPlans.all,
  ],
} as const;

/**
 * Helper to invalidate multiple query keys
 *
 * @example
 * const queryClient = useQueryClient()
 *
 * // In mutation onSuccess
 * onSuccess: () => {
 *   invalidateQueries(queryClient, invalidationPatterns.afterCheckoutComplete())
 * }
 */
export function invalidateQueries(
  queryClient: QueryClient,
  keys: readonly unknown[][]
): Promise<void[]> {
  return Promise.all(
    keys.map((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] }))
  );
}

/**
 * Helper to invalidate queries with specific matching
 *
 * @example
 * // Invalidate all user queries
 * invalidateByPrefix(queryClient, queryKeys.user.all)
 *
 * // Invalidate specific checkout
 * invalidateByPrefix(queryClient, queryKeys.checkout.detail('token123'))
 */
export function invalidateByPrefix(
  queryClient: QueryClient,
  queryKeyPrefix: readonly unknown[]
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: queryKeyPrefix as unknown[],
    // exact: false means it will match all queries that start with this prefix
  });
}

/**
 * Reset queries (remove from cache completely)
 * Use sparingly - prefer invalidation for most cases
 *
 * @example
 * // After logout, remove all user data
 * resetQueries(queryClient, invalidationPatterns.onLogout())
 */
export function resetQueries(
  queryClient: QueryClient,
  keys: readonly unknown[][]
): void {
  keys.forEach((key) => {
    queryClient.resetQueries({ queryKey: key as unknown[] });
  });
}

/**
 * Cancel ongoing queries
 * Use before mutations that will invalidate the same data
 *
 * @example
 * // Before updating payment methods
 * await cancelQueries(queryClient, [queryKeys.paymentMethods.all])
 */
export function cancelQueries(
  queryClient: QueryClient,
  keys: readonly unknown[][]
): Promise<void[]> {
  return Promise.all(
    keys.map((key) => queryClient.cancelQueries({ queryKey: key as unknown[] }))
  );
}

/**
 * Optimistic update helper
 *
 * @example
 * const mutation = useMutation({
 *   mutationFn: updatePaymentMethod,
 *   onMutate: async (newData) => {
 *     return optimisticUpdate(
 *       queryClient,
 *       queryKeys.paymentMethods.byUser(userId),
 *       (oldData) => [...oldData, newData]
 *     )
 *   },
 *   onError: (err, variables, context) => {
 *     // Rollback on error
 *     queryClient.setQueryData(
 *       queryKeys.paymentMethods.byUser(userId),
 *       context?.previousData
 *     )
 *   },
 *   onSettled: () => {
 *     // Always refetch after mutation
 *     invalidateByPrefix(queryClient, queryKeys.paymentMethods.all)
 *   }
 * })
 */
export async function optimisticUpdate<TData>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updateFn: (oldData: TData | undefined) => TData
): Promise<{ previousData: TData | undefined }> {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: queryKey as unknown[] });

  // Snapshot the previous value
  const previousData = queryClient.getQueryData<TData>(queryKey as unknown[]);

  // Optimistically update
  queryClient.setQueryData(queryKey as unknown[], updateFn(previousData));

  return { previousData };
}

/**
 * Prefetch related queries
 * Use to improve perceived performance
 *
 * @example
 * // When user hovers over checkout button
 * prefetchRelatedQueries(queryClient, 'checkout', { checkoutToken })
 */
export async function prefetchRelatedQueries(
  queryClient: QueryClient,
  context: "checkout" | "profile" | "payment",
  params: Record<string, string>
): Promise<void> {
  switch (context) {
    case "checkout":
      if (params.checkoutToken) {
        // Prefetch checkout details
        await queryClient.prefetchQuery({
          queryKey: queryKeys.checkout.detail(params.checkoutToken),
          staleTime: 1000 * 60, // 1 minute
        });
      }
      break;

    case "profile":
      // Prefetch user details and payment methods
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.user.details(),
          staleTime: 1000 * 60 * 5, // 5 minutes
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.paymentMethods.byUser(params.userId ?? ""),
          staleTime: 1000 * 60 * 5,
        }),
      ]);
      break;

    case "payment":
      // Prefetch payment methods and credit accounts
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.paymentMethods.byUser(params.userId ?? ""),
          staleTime: 1000 * 60 * 5,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.creditAccounts.list(),
          staleTime: 1000 * 60,
        }),
      ]);
      break;
  }
}
