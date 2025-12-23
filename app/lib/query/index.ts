/**
 * Query Utilities Index
 *
 * Re-exports all query-related utilities for easy importing.
 *
 * @example
 * import { queryKeys, createQueryClient, invalidationPatterns } from '~/lib/query'
 */

// Query key factory
export { queryKeys, getDomainKey } from "./queryKeys";
export type { QueryKeys } from "./queryKeys";

// Query client configuration
export {
  createQueryClient,
  getQueryClient,
  resetQueryClient,
  TIME,
  STALE_TIMES,
  GC_TIMES,
} from "./queryClient";

// Query options
export {
  userDetailsOptions,
  multipleUserDetailsOptions,
  paymentMethodsOptions,
  checkoutDetailOptions,
  merchantDetailOptions,
  creditAccountsOptions,
  smartpayPlanOptions,
  smartpayDetailedPlanOptions,
  smartpayIncomesOptions,
  smartpayPreferencesOptions,
  availableDiscountsOptions,
  isProductMonitoredOptions,
  contactsInfiniteOptions,
} from "./queryOptions";

// Invalidation utilities
export {
  invalidationPatterns,
  invalidateQueries,
  invalidateByPrefix,
  resetQueries,
  cancelQueries,
  optimisticUpdate,
  prefetchRelatedQueries,
} from "./invalidation";

// Prefetching utilities for route transitions
export {
  prefetchUserData,
  prefetchUserAndPaymentMethods,
  prefetchCheckoutData,
  prefetchPaymentOptionsData,
  hasValidCachedData,
  refetchQuery,
  cancelQuery,
} from "./prefetch";
