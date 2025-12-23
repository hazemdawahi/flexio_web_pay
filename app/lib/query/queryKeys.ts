/**
 * Query Key Factory
 *
 * Centralized query key management following React Query best practices.
 * This factory provides type-safe, consistent query keys across the application.
 *
 * Benefits:
 * - Type safety for query keys
 * - Consistent key structure
 * - Easy invalidation of related queries
 * - Better cache management
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */

import type { Frequency } from "~/hooks/useFinancialCalendarPlan";

/**
 * Query key factory for all application queries.
 * Uses a hierarchical structure: [domain, entity?, params?]
 *
 * IMPORTANT: Do NOT include authentication tokens in query keys.
 * Use the `enabled` option instead to control when queries run.
 */
export const queryKeys = {
  // ========================
  // User Domain
  // ========================
  user: {
    /** Base key for all user queries */
    all: ["user"] as const,

    /** Current user details */
    details: () => [...queryKeys.user.all, "details"] as const,

    /** Multiple user details by IDs */
    multiple: (userIds: string[]) =>
      [...queryKeys.user.all, "multiple", { userIds }] as const,

    /** User contacts */
    contacts: {
      all: () => [...queryKeys.user.all, "contacts"] as const,

      /** Infinite contacts with filters */
      infinite: (params: {
        size: number;
        contacts?: string | string[];
        searchTerm?: string;
        isSubscribed?: boolean | string;
        excludeUserIds?: string | string[];
        sort?: string;
      }) => [...queryKeys.user.contacts.all(), "infinite", params] as const,
    },
  },

  // ========================
  // Merchant Domain
  // ========================
  merchant: {
    /** Base key for all merchant queries */
    all: ["merchant"] as const,

    /** Single merchant by ID */
    detail: (merchantId: string) =>
      [...queryKeys.merchant.all, "detail", merchantId] as const,
  },

  // ========================
  // Checkout Domain
  // ========================
  checkout: {
    /** Base key for all checkout queries */
    all: ["checkout"] as const,

    /** Checkout details by token */
    detail: (checkoutToken: string) =>
      [...queryKeys.checkout.all, "detail", checkoutToken] as const,
  },

  // ========================
  // Payment Methods Domain
  // ========================
  paymentMethods: {
    /** Base key for all payment method queries */
    all: ["paymentMethods"] as const,

    /** Payment methods by user ID */
    byUser: (userId: string) =>
      [...queryKeys.paymentMethods.all, userId] as const,
  },

  // ========================
  // Credit Accounts Domain
  // ========================
  creditAccounts: {
    /** Base key for all credit account queries */
    all: ["creditAccounts"] as const,

    /** User's credit accounts */
    list: () => [...queryKeys.creditAccounts.all, "list"] as const,
  },

  // ========================
  // Discounts Domain
  // ========================
  discounts: {
    /** Base key for all discount queries */
    all: ["discounts"] as const,

    /** Available discounts for merchant and amount */
    available: (merchantId: string, orderAmount: number) =>
      [...queryKeys.discounts.all, "available", { merchantId, orderAmount }] as const,
  },

  // ========================
  // SmartPay Domain
  // ========================
  smartpay: {
    /** Base key for all SmartPay queries */
    all: ["smartpay"] as const,

    /** SmartPay plan for a price */
    plan: (price: number) =>
      [...queryKeys.smartpay.all, "plan", { price }] as const,

    /** Detailed SmartPay plan with all parameters */
    detailedPlan: (params: {
      price: number;
      frequency: Frequency;
      instantaneous: boolean;
      yearly: boolean;
      interestFreeTotal: number;
    }) => [...queryKeys.smartpay.all, "detailedPlan", params] as const,

    /** User's SmartPay incomes */
    incomes: () => [...queryKeys.smartpay.all, "incomes"] as const,

    /** User's SmartPay preferences */
    preferences: () => [...queryKeys.smartpay.all, "preferences"] as const,
  },

  // ========================
  // Product Monitoring Domain
  // ========================
  products: {
    /** Base key for all product queries */
    all: ["products"] as const,

    /** Monitored products list */
    monitored: {
      all: () => [...queryKeys.products.all, "monitored"] as const,

      /** Check if specific product is monitored */
      isMonitored: (productId: string) =>
        [...queryKeys.products.monitored.all(), productId] as const,
    },
  },

  // ========================
  // Payment Plans Domain
  // ========================
  paymentPlans: {
    /** Base key for all payment plan queries */
    all: ["paymentPlans"] as const,

    /** Payment plan terms */
    terms: (params: { frequency: string; amount: number }) =>
      [...queryKeys.paymentPlans.all, "terms", params] as const,

    /** Financial calendar plan */
    calendar: (params: Record<string, unknown>) =>
      [...queryKeys.paymentPlans.all, "calendar", params] as const,
  },

  // ========================
  // Plaid Domain
  // ========================
  plaid: {
    /** Base key for all Plaid queries */
    all: ["plaid"] as const,

    /** Plaid link token */
    linkToken: () => [...queryKeys.plaid.all, "linkToken"] as const,

    /** Plaid tokens */
    tokens: () => [...queryKeys.plaid.all, "tokens"] as const,
  },

  // ========================
  // Unified Commerce Domain
  // ========================
  commerce: {
    /** Base key for all commerce queries */
    all: ["commerce"] as const,

    /** Virtual cards */
    virtualCards: () => [...queryKeys.commerce.all, "virtualCards"] as const,

    /** BNPL cards */
    bnplCards: () => [...queryKeys.commerce.all, "bnplCards"] as const,

    /** Active card */
    activeCard: () => [...queryKeys.commerce.all, "activeCard"] as const,

    /** Payments */
    payments: () => [...queryKeys.commerce.all, "payments"] as const,

    /** Checkouts */
    checkouts: () => [...queryKeys.commerce.all, "checkouts"] as const,

    /** Sends */
    sends: () => [...queryKeys.commerce.all, "sends"] as const,

    /** Requests */
    requests: () => [...queryKeys.commerce.all, "requests"] as const,

    /** Soteria payments */
    soteriaPayments: () => [...queryKeys.commerce.all, "soteriaPayments"] as const,
  },
} as const;

/**
 * Type helper to extract query key types
 */
export type QueryKeys = typeof queryKeys;

/**
 * Helper to get all keys for a domain (useful for broad invalidation)
 *
 * @example
 * // Invalidate all user-related queries
 * queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
 */
export function getDomainKey(domain: keyof QueryKeys) {
  return queryKeys[domain].all;
}
