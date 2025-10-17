// File: src/hooks/useUnifiedCommerce.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

/** =========================
 * Config
 * ========================= */
const TIMEOUT_MS = 60_000; // 60 seconds
const isBrowser = typeof window !== 'undefined';

function pickValidApiHost(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === 'string' ? c : '').trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (['false', '0', 'null', 'undefined'].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ''); // strip trailing slashes
  }
  return undefined;
}

function getApiBase(): string {
  return (
    pickValidApiHost(
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.REACT_APP_API_HOST) as string | undefined,
      (typeof process !== 'undefined' && (process as any).env?.API_HOST) as string | undefined,
    ) || 'http://192.168.1.121:8080'
  );
}

/** =========================
 * Shared types (align with backend DTOs)
 * ========================= */

export type UnifiedOperationType =
  | 'CHECKOUT'
  | 'PAYMENT'
  | 'SEND'
  | 'ACCEPT_REQUEST'
  | 'ACCEPT_SPLIT_REQUEST'
  | 'VIRTUAL_CARD'
  | 'SOTERIA_PAYMENT';

export type FrequencyEnum =
  | 'DAILY'
  | 'WEEKLY'
  | 'BI_WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY'
  | 'YEARLY'
  | string;

/** Money-like input the backend accepts */
export type MoneyLike =
  | string
  | number
  | {
      id?: string | null;
      amount: string | number;
      currency: string;
      createdAt?: string | null;
      updatedAt?: string | null;
      version?: number | null;
    };

export interface SuperchargeDetail {
  amount: number | string; // BigDecimal on backend (accept string or number)
  paymentMethodId: string;
}

export interface SplitPaymentDetail {
  // id removed to match backend / cURL
  status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | string;
  dueDate: string; // "YYYY-MM-DD"
  amount?: number | string;
  originalAmount?: number | string;
  interestFreeSlice?: number | string;
  interestRate?: number | string; // e.g. 0.00625
  interestAmount?: number | string;
  originalInterestAmount?: number | string;
}

export interface OtherUserSplit {
  userId: string;
  amount: number | string;
  // checkoutId removed per latest DTOs
}

/** Common planning/auth fields used across operations (top-level in your cURL) */
export interface CommonPlanFields {
  paymentFrequency?: FrequencyEnum;
  numberOfPayments?: number;
  offsetStartDate?: string; // "YYYY-MM-DD"
  instantAmount?: number | string;
  yearlyAmount?: number | string;
  selectedPaymentMethod?: string;
  superchargeDetails?: SuperchargeDetail[];
  splitSuperchargeDetails?: SuperchargeDetail[];
  selfPayActive?: boolean;
  totalPlanAmount?: number | string;
  interestFreeUsed?: number | string;
  interestRate?: number | string;
  apr?: number | string;
  /** Present in cURL at top-level */
  originalTotalInterest?: number | string | null;
  currentTotalInterest?: number | string | null;
  schemeAmount?: number | string; // matches cURL
  splitPaymentsList?: SplitPaymentDetail[];
  /** Top-level discountIds per examples */
  discountIds?: string[];
  /** Top-level co-payers */
  otherUsers?: OtherUserSplit[];
}

/** Legacy/optional nested block support for CHECKOUT (kept for backward compat) */
export interface CheckoutBlock {
  checkoutToken?: string | null;
  merchantId?: string | null; // maps to top-level checkoutMerchantId if used there
  redirectUrl?: string | null;
  reference?: string | null;
  checkoutDetails?: any | null;
  // no totalAmount here (cURL does not send any checkout amount field)
  checkoutType?: 'ONLINE' | 'IN_STORE' | string | null;
  discountIds?: string[];
  otherUsers?: OtherUserSplit[];
  metadata?: Record<string, any>;
}

/** VIRTUAL_CARD options object exactly as in your cURL */
export interface VirtualCardOptions {
  cardOnly?: boolean;                 // default false
  disableControls?: boolean;          // default false
  prefund?: boolean;                  // default true
  approvalsOnly?: boolean;            // default true
  activateCard?: boolean;             // default true
  expirationHours?: number;           // default 24
  showPan?: boolean;                  // default false
  showCvv?: boolean;                  // default false
  prefundAmount?: MoneyLike | null;   // Money
  singleUse?: boolean | null;
  spendControlProfileId?: string | null;
  memo?: string | null;
}

/** =========================
 * Request unions (discriminated by "type")
 * ========================= */

export interface CheckoutRequest extends CommonPlanFields {
  type: 'CHECKOUT';

  /** Top-level (as per cURL) */
  checkoutToken?: string | null;
  checkoutMerchantId?: string | null;
  checkoutRedirectUrl?: string | null;
  checkoutReference?: string | null;
  checkoutDetails?: any | null;
  // no checkoutTotalAmount (not in cURL)
  checkoutType?: 'ONLINE' | 'IN_STORE' | string | null;

  /** Backward-compatible nested block (optional) */
  checkout?: CheckoutBlock;
}

export interface PaymentRequest extends CommonPlanFields {
  type: 'PAYMENT';

  /** Top-level (as per cURL) */
  paymentTotalAmount?: MoneyLike | null;
  merchantId?: string | null;

  /** Back-compat extras */
  merchantBase?: any | null;
  paymentId?: string | null; // legacy resume knob (server may ignore)
}

export interface SendRecipient {
  recipientId: string;
  amount: number | string;
}

export interface SendRequest extends CommonPlanFields {
  type: 'SEND';
  senderId?: string | null; // leave blank → server uses current user
  recipient: SendRecipient;
  note?: string | null;
}

export interface AcceptRequest extends CommonPlanFields {
  type: 'ACCEPT_REQUEST';
  requestId: string; // Request id
}

export interface AcceptSplitRequest extends CommonPlanFields {
  type: 'ACCEPT_SPLIT_REQUEST';
  requestId: string; // SplitRequest id (API shares the same key)
}

export interface VirtualCardRequest extends CommonPlanFields {
  type: 'VIRTUAL_CARD';
  /** Top-level merchant id is REQUIRED in your cURL examples */
  merchantId: string;

  /** Options object named exactly "virtualCard" (matches cURL) */
  virtualCard?: VirtualCardOptions;

  /** Back-compat alias if older callers used "card" */
  card?: VirtualCardOptions;
}

/** SOTERIA_PAYMENT */
export interface SoteriaPaymentRequest extends CommonPlanFields {
  type: 'SOTERIA_PAYMENT';

  /** Optional identifiers / totals */
  merchantId?: string | null;
  soteriaPaymentTotalAmount?: MoneyLike | null;
  soteriaPayload?: Record<string, any> | null;
  /** Alias accepted by some servers */
  paymentTotalAmount?: MoneyLike | null;

  /** Explicit identifiers */
  paymentPlanId?: string | undefined;
  paymentSchemeId?: string | undefined;
  splitPaymentId?: string | undefined;

  /** Pass-through */
  [k: string]: any;
}

export type UnifiedCommerceRequest =
  | CheckoutRequest
  | PaymentRequest
  | SendRequest
  | AcceptRequest
  | AcceptSplitRequest
  | VirtualCardRequest
  | SoteriaPaymentRequest;

/** =========================
 * Response types (align with UnifiedCommerceResponse)
 * ========================= */

export interface UnifiedCheckoutResponse {
  id?: string;
  redirectCheckoutUrl?: string | null;
  token?: string | null;
  checkoutToken?: string | null;
  reference?: string | null;
  sandbox?: boolean;
  state?: string;
  checkoutType?: string;
  totalAmount?: { id?: string; amount?: number | string; currency?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedPaymentResponse {
  id?: string;
  sandbox?: boolean;
  state?: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedSend {
  id?: string;
  sender?: { id?: string };
  recipient?: { id?: string };
  amount?: number | string;
  type?: 'INSTANTANEOUS' | 'YEARLY' | string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedRequestResponse {
  id?: string;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
}

export interface UnifiedCardResponse {
  card_token?: string;
  controls_created?: boolean;
  prefunded?: boolean;
  [k: string]: any;
}

export interface UnifiedCommerceResponse {
  type?: UnifiedOperationType | string;
  message?: string;

  checkout?: UnifiedCheckoutResponse | null;
  payment?: UnifiedPaymentResponse | null;
  send?: UnifiedSend | null;
  soteriaPayment?: Record<string, any> | null;
  request?: UnifiedRequestResponse | null;
  cardResponse?: UnifiedCardResponse | string | null;

  [k: string]: any;
}

/** =========================
 * Internal sanitizers
 * ========================= */

function isPlainObject(x: any): x is Record<string, any> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Recursively remove properties that backend may reject when empty.
 * Specifically handle `splitPaymentsList` and empty array of `splitSuperchargeDetails`.
 */
function pruneEmptyLists(obj: any) {
  if (Array.isArray(obj)) {
    obj.forEach(pruneEmptyLists);
    return;
  }
  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];

    if (key === 'splitPaymentsList') {
      const isEmptyArray = Array.isArray(val) && val.length === 0;
      const isNullish = val == null; // null or undefined
      if (isEmptyArray || isNullish) {
        delete (obj as any)[key];
        continue;
      }
    }

    if (key === 'splitSuperchargeDetails' && Array.isArray(val) && val.length === 0) {
      delete (obj as any)[key];
      continue;
    }

    pruneEmptyLists(val);
  }
}

/** Strip the VirtualCard control flags when they equal backend defaults */
const CARD_DEFAULTS: Record<string, any> = {
  cardOnly: false,
  disableControls: false,
  prefund: true,
  approvalsOnly: true,
  activateCard: true,
  expirationHours: 24,
  showPan: false,
  showCvv: false,
};

function pruneCardDefaultFlags(obj: any) {
  if (Array.isArray(obj)) {
    obj.forEach(pruneCardDefaultFlags);
    return;
  }
  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];

    if (key in CARD_DEFAULTS) {
      const def = CARD_DEFAULTS[key];
      const isEqualDefault =
        (typeof def === 'number' && typeof val === 'number' && val === def) ||
        (typeof def === 'boolean' && typeof val === 'boolean' && val === def);

      if (val == null || isEqualDefault) {
        delete (obj as any)[key];
        continue;
      }
    }

    pruneCardDefaultFlags(val);
  }
}

/** Force remove ALL splitPaymentsList keys anywhere in the object */
function stripAllSplitPayments(obj: any) {
  if (Array.isArray(obj)) {
    obj.forEach(stripAllSplitPayments);
    return;
  }
  if (!isPlainObject(obj)) return;

  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (key === 'splitPaymentsList') {
      delete (obj as any)[key];
      continue;
    }
    stripAllSplitPayments(val);
  }
}

/** Normalize to the exact top-level keys your backend expects */
function normalizeToTopLevel(body: UnifiedCommerceRequest): UnifiedCommerceRequest {
  const clone = JSON.parse(JSON.stringify(body)) as UnifiedCommerceRequest;

  // ---- Normalize Virtual Card: allow older 'card' alias but send 'virtualCard'
  if ((clone as any).card && !(clone as any).virtualCard) {
    (clone as any).virtualCard = (clone as any).card;
    delete (clone as any).card;
  }

  // Strip defaulted flags within virtualCard
  if ((clone as any).virtualCard) {
    pruneCardDefaultFlags((clone as any).virtualCard);
  }

  // ---- Back-compat: If a nested `checkout` block exists, lift only allowed fields
  const asCheckout = clone as CheckoutRequest;
  const c = (asCheckout as any).checkout;
  if (c && isPlainObject(c)) {
    asCheckout.checkoutToken = asCheckout.checkoutToken ?? c.checkoutToken ?? null;
    asCheckout.checkoutMerchantId = asCheckout.checkoutMerchantId ?? (c.merchantId as any);
    asCheckout.checkoutRedirectUrl = asCheckout.checkoutRedirectUrl ?? c.redirectUrl ?? null;
    asCheckout.checkoutReference = asCheckout.checkoutReference ?? c.reference ?? null;
    asCheckout.checkoutDetails = asCheckout.checkoutDetails ?? c.checkoutDetails ?? null;
    // do not lift any total amount field (not in cURL)
    asCheckout.checkoutType = asCheckout.checkoutType ?? (c.checkoutType as any);

    // Also bring up discountIds/otherUsers if they were nested
    if (c.discountIds && Array.isArray(c.discountIds)) {
      (asCheckout as any).discountIds = (asCheckout as any).discountIds ?? c.discountIds;
    }
    if (c.otherUsers && Array.isArray(c.otherUsers)) {
      (asCheckout as any).otherUsers = (asCheckout as any).otherUsers ?? c.otherUsers;
    }

    delete (asCheckout as any).checkout;
  }

  return clone;
}

/** Make deep clone then prune (no generics to avoid TS2322) */
function sanitizeUnifiedRequest(body: UnifiedCommerceRequest): UnifiedCommerceRequest {
  const normalized = normalizeToTopLevel(body);
  pruneEmptyLists(normalized);
  return normalized;
}

/* ---------------- Token helper (web) ---------------- */
async function getWebToken(): Promise<string> {
  if (!isBrowser) throw new Error('Token storage unavailable during SSR');
  const token = window.sessionStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found');
  return token;
}

/** =========================
 * Low-level caller (with retry if server complains about splitPaymentsList)
 * ========================= */

async function callUnifiedCommerce(
  body: UnifiedCommerceRequest
): Promise<UnifiedCommerceResponse> {
  const token = await getWebToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const url = `${getApiBase()}/api/user/unified`;

  async function sendOnce(payload: UnifiedCommerceRequest) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // credentials: 'include', // enable only if API needs cookies
    });

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    const parseMaybeJson = () => {
      if (contentType.includes('application/json')) {
        try {
          return JSON.parse(rawText);
        } catch {
          return { message: rawText };
        }
      }
      return { message: rawText };
    };

    return { ok: res.ok, status: res.status, data: parseMaybeJson(), rawText };
  }

  try {
    // First try with safe sanitized body
    const safeBody = sanitizeUnifiedRequest(body);
    let first = await sendOnce(safeBody);
    if (first.ok) {
      return first.data as UnifiedCommerceResponse;
    }

    // If server complains about splitPaymentsList, retry after stripping all occurrences
    const msg = String(
      (first.data && (first.data as any).error) ||
        (first.data && (first.data as any).message) ||
        first.rawText ||
        ''
    ).toLowerCase();

    if (
      msg.includes('splitpaymentslist must not be null or empty') ||
      (msg.includes('splitpaymentslist') && msg.includes('must not be empty')) ||
      (msg.includes('split payments list') && msg.includes('empty'))
    ) {
      const retryBody = JSON.parse(JSON.stringify(safeBody)) as UnifiedCommerceRequest;
      stripAllSplitPayments(retryBody);

      // Also: if numberOfPayments is 0/negative anywhere, bump to 1
      const bumpNumberOfPayments = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach(bumpNumberOfPayments);
          return;
        }
        if (!isPlainObject(obj)) return;

        if (typeof obj.numberOfPayments === 'number' && obj.numberOfPayments <= 0) {
          obj.numberOfPayments = 1;
        }
        if (
          obj.virtualCard &&
          typeof obj.virtualCard.numberOfPayments === 'number' &&
          obj.virtualCard.numberOfPayments <= 0
        ) {
          obj.virtualCard.numberOfPayments = 1;
        }
        Object.values(obj).forEach(bumpNumberOfPayments);
      };
      bumpNumberOfPayments(retryBody);

      const second = await sendOnce(retryBody);
      if (second.ok) {
        return second.data as UnifiedCommerceResponse;
      }

      const txt =
        (second.data && ((second.data as any).error || (second.data as any).message)) ||
        second.rawText ||
        `Request failed with status ${second.status}`;
      throw new Error(txt);
    }

    const text =
      (first.data && ((first.data as any).error || (first.data as any).message)) ||
      first.rawText ||
      `Request failed with status ${first.status}`;
    throw new Error(text);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** =========================
 * React Query hook (single entry point)
 * ========================= */

export function useUnifiedCommerce() {
  const queryClient = useQueryClient();

  return useMutation<UnifiedCommerceResponse, Error, UnifiedCommerceRequest>({
    mutationFn: callUnifiedCommerce,
    onSuccess: (_data, variables) => {
      // Invalidate likely-affected caches (tweak to your app’s query keys)
      queryClient.invalidateQueries({ queryKey: ['virtualCards'] });
      queryClient.invalidateQueries({ queryKey: ['bnplCards'] });
      queryClient.invalidateQueries({ queryKey: ['activeCard'] });

      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['checkouts'] });

      queryClient.invalidateQueries({ queryKey: ['send'] });
      queryClient.invalidateQueries({ queryKey: ['sends'] });

      queryClient.invalidateQueries({ queryKey: ['requests'] });

      queryClient.invalidateQueries({ queryKey: ['soteria'] });
      queryClient.invalidateQueries({ queryKey: ['soteriaPayments'] });

      // Optionally branch by op type if you want very targeted invalidations
      // if (variables.type === 'SEND') { ... }
      // if (variables.type === 'SOTERIA_PAYMENT') { ... }
    },
    onError: (error) => {
      console.error('Unified commerce failed:', error.message);
    },
  });
}

/** =========================
 * Helper builders (optional sugar)
 * ========================= */

// 1) CHECKOUT (top-level fields as per cURL)
export function buildCheckoutRequest(
  topLevel: {
    checkoutToken?: string | null;
    checkoutMerchantId?: string | null;
    checkoutRedirectUrl?: string | null;
    checkoutReference?: string | null;
    checkoutDetails?: any | null;
    // no checkoutTotalAmount here
    checkoutType?: 'ONLINE' | 'IN_STORE' | string | null;
  },
  common?: CommonPlanFields
): CheckoutRequest {
  return {
    type: 'CHECKOUT',
    ...topLevel,
    ...common,
  };
}

// 2) PAYMENT (top-level as per cURL)
export function buildPaymentRequest(
  opts: {
    merchantId?: string | null;
    paymentTotalAmount?: MoneyLike | null;
  },
  common?: CommonPlanFields
): PaymentRequest {
  return {
    type: 'PAYMENT',
    merchantId: opts.merchantId ?? null,
    paymentTotalAmount: opts.paymentTotalAmount ?? null,
    ...common,
  };
}

// 2b) PAYMENT (resume by id, if supported server-side)
export function buildPaymentResumeRequest(
  paymentId: string,
  extra?: Omit<PaymentRequest, 'type' | 'paymentId'>
): PaymentRequest {
  return {
    type: 'PAYMENT',
    paymentId,
    ...(extra as any),
  };
}

// 3) SEND
export function buildSendRequest(
  recipient: SendRecipient,
  opts?: { senderId?: string | null; note?: string | null },
  common?: CommonPlanFields
): SendRequest {
  return {
    type: 'SEND',
    senderId: opts?.senderId ?? null,
    recipient,
    note: opts?.note ?? null,
    ...common,
  };
}

// 4) ACCEPT_REQUEST
export function buildAcceptRequest(
  requestId: string,
  common?: CommonPlanFields
): AcceptRequest {
  return {
    type: 'ACCEPT_REQUEST',
    requestId,
    ...common,
  };
}

// 5) ACCEPT_SPLIT_REQUEST
export function buildAcceptSplitRequest(
  requestId: string,
  common?: CommonPlanFields
): AcceptSplitRequest {
  return {
    type: 'ACCEPT_SPLIT_REQUEST',
    requestId,
    ...common,
  };
}

// 6a) VIRTUAL_CARD (explicit virtualCard options object)
export function buildVirtualCardRequestWithOptions(
  merchantId: string,
  virtualCard: VirtualCardOptions,
  common?: CommonPlanFields
): VirtualCardRequest {
  return {
    type: 'VIRTUAL_CARD',
    merchantId,
    virtualCard,
    ...common,
  };
}

// 6b) VIRTUAL_CARD (only required merchantId; use common for plan fields)
export function buildVirtualCardRequest(
  merchantId: string,
  common?: CommonPlanFields
): VirtualCardRequest {
  return {
    type: 'VIRTUAL_CARD',
    merchantId,
    ...common,
  };
}

// 7) SOTERIA_PAYMENT
export function buildSoteriaPaymentRequest(
  opts?: {
    merchantId?: string | null;
    soteriaPaymentTotalAmount?: MoneyLike | null;
    soteriaPayload?: Record<string, any> | null;
    /** Compatibility alias accepted by server */
    paymentTotalAmount?: MoneyLike | null;

    /** Explicit IDs */
    paymentPlanId?: string;
    paymentSchemeId?: string;
    splitPaymentId?: string;
  },
  common?: CommonPlanFields
): SoteriaPaymentRequest {
  return {
    type: 'SOTERIA_PAYMENT',
    merchantId: opts?.merchantId ?? null,
    soteriaPaymentTotalAmount: opts?.soteriaPaymentTotalAmount ?? null,
    soteriaPayload: opts?.soteriaPayload ?? null,
    paymentTotalAmount: opts?.paymentTotalAmount ?? null,
    paymentPlanId: opts?.paymentPlanId,
    paymentSchemeId: opts?.paymentSchemeId,
    splitPaymentId: opts?.splitPaymentId,
    ...common,
  };
}
