/**
 * Query Client Configuration
 *
 * Centralized configuration for React Query with optimized defaults
 * for performance, caching, and user experience.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/important-defaults
 */

import { QueryClient } from "@tanstack/react-query";
import { AuthError } from "~/lib/auth/apiClient";

/**
 * Time constants for better readability
 */
export const TIME = {
  SECONDS: (n: number) => n * 1000,
  MINUTES: (n: number) => n * 60 * 1000,
  HOURS: (n: number) => n * 60 * 60 * 1000,
} as const;

/**
 * Default stale times by data type
 * Adjust these based on how frequently your data changes
 */
export const STALE_TIMES = {
  /** User profile data - rarely changes */
  USER: TIME.MINUTES(10),

  /** Payment methods - changes infrequently */
  PAYMENT_METHODS: TIME.MINUTES(5),

  /** Checkout data - session-specific, moderate staleness */
  CHECKOUT: TIME.MINUTES(2),

  /** SmartPay plans - calculated, cache longer */
  SMARTPAY: TIME.MINUTES(5),

  /** Discounts - can change, moderate staleness */
  DISCOUNTS: TIME.MINUTES(2),

  /** Contacts - can grow, moderate staleness */
  CONTACTS: TIME.MINUTES(3),

  /** Credit accounts - sensitive, refresh more often */
  CREDIT_ACCOUNTS: TIME.MINUTES(1),

  /** Default for unspecified queries */
  DEFAULT: TIME.MINUTES(5),
} as const;

/**
 * Garbage collection times
 * How long to keep inactive query data in cache
 */
export const GC_TIMES = {
  /** Default garbage collection time */
  DEFAULT: TIME.MINUTES(30),

  /** Short-lived data */
  SHORT: TIME.MINUTES(10),

  /** Long-lived data */
  LONG: TIME.HOURS(1),
} as const;

/**
 * Custom error handler for global query errors
 */
function handleQueryError(error: unknown): void {
  // Log all errors for debugging
  console.error("[React Query Error]:", error);

  // AuthErrors are handled by individual hooks with navigation
  // Don't show toast for auth errors as user will be redirected
  if (error instanceof AuthError) {
    return;
  }

  // For network errors, could add offline handling here
  if (error instanceof TypeError && error.message.includes("fetch")) {
    console.warn("Network error detected - may be offline");
  }
}

/**
 * Create and configure the QueryClient
 *
 * Configuration philosophy:
 * - Conservative refetching to prevent unnecessary API calls
 * - Generous caching for better UX on navigation
 * - Smart retry logic for transient failures
 * - Structured error handling
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // ========================
        // Caching Configuration
        // ========================

        /** Data is considered fresh for this duration */
        staleTime: STALE_TIMES.DEFAULT,

        /** Keep inactive data in cache for garbage collection */
        gcTime: GC_TIMES.DEFAULT,

        // ========================
        // Refetch Behavior
        // ========================

        /**
         * Don't refetch on mount if data exists and is fresh
         * This prevents unnecessary refetches on back navigation
         */
        refetchOnMount: "always",

        /**
         * Refetch when window regains focus (for data freshness)
         * Set to 'always' if you want to refetch even when data is fresh
         */
        refetchOnWindowFocus: false,

        /**
         * Refetch when network reconnects
         * Useful for mobile/unstable connections
         */
        refetchOnReconnect: true,

        // ========================
        // Retry Configuration
        // ========================

        /**
         * Retry failed requests up to 2 times
         * Don't retry auth errors or client errors
         */
        retry: (failureCount, error) => {
          // Never retry auth errors
          if (error instanceof AuthError) {
            return false;
          }

          // Don't retry client errors (4xx except 429)
          if (
            error instanceof Error &&
            error.message.includes("Error 4") &&
            !error.message.includes("Error 429")
          ) {
            return false;
          }

          // Retry up to 2 times for other errors
          return failureCount < 2;
        },

        /**
         * Exponential backoff for retries
         * Starts at 1s, doubles each time, max 30s
         */
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 30000),

        // ========================
        // Network Mode
        // ========================

        /**
         * 'online' - Only fetch when online (default, best for API calls)
         * 'always' - Always try to fetch (for local data sources)
         * 'offlineFirst' - Try cache first, then network
         */
        networkMode: "online",

        // ========================
        // Structural Sharing
        // ========================

        /**
         * Enable structural sharing for referential stability
         * Improves React rendering performance
         */
        structuralSharing: true,
      },

      mutations: {
        // ========================
        // Mutation Configuration
        // ========================

        /**
         * Retry failed mutations once
         * More conservative than queries since mutations change state
         */
        retry: (failureCount, error) => {
          // Never retry auth errors
          if (error instanceof AuthError) {
            return false;
          }

          // Retry once for transient errors
          return failureCount < 1;
        },

        /**
         * Network mode for mutations
         */
        networkMode: "online",

        /**
         * Global error handler for mutations
         */
        onError: handleQueryError,
      },
    },
  });
}

/**
 * Singleton query client instance
 * Use this in your app's root component
 */
let queryClientSingleton: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = createQueryClient();
  }
  return queryClientSingleton;
}

/**
 * Reset the query client (useful for testing or logout)
 */
export function resetQueryClient(): void {
  if (queryClientSingleton) {
    queryClientSingleton.clear();
  }
}
