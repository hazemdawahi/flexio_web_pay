import { useMutation, useQueryClient } from '@tanstack/react-query';

// Define the structure of the response
interface MarkPrimaryResponse {
  success: boolean;
  data: string | null;
  errorMessage: string | null;
}

// Define the request payload
interface MarkPrimaryRequest {
  paymentMethodId: string;
}

// API function to mark a payment method as primary
async function markPrimaryPaymentMethod(
  requestData: MarkPrimaryRequest
): Promise<MarkPrimaryResponse> {
  try {
    // Retrieve the JWT token from sessionStorage instead of SecureStore
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }

    // Make the API request
    const response = await fetch('http://192.168.1.121:8080/customer/mark-primary', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, // Bearer token for authentication
        'Content-Type': 'application/json', // Set JSON content type
      },
      body: JSON.stringify(requestData), // Request payload
    });

    // Parse the response JSON
    const data = await response.json();

    // Handle HTTP errors
    if (!response.ok) {
      throw new Error(data.errorMessage || 'Failed to mark payment method as primary');
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to mark payment method as primary');
  }
}

// React Query hook for marking a payment method as primary
export function useMarkPrimaryPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestData: MarkPrimaryRequest) =>
      markPrimaryPaymentMethod(requestData),
    onSuccess: (data) => {
      if (data.success) {
        console.log('Payment method marked as primary successfully:', data.data);
        queryClient.invalidateQueries({ queryKey: ['paymentMethods'] }); // Invalidate queries to refetch updated data
      } else {
        console.error('Failed to mark payment method as primary:', data.errorMessage);
      }
    },
    onError: (error) => {
      console.error('Error marking payment method as primary:', error);
    },
  });
}
// File: src/hooks/useTransactionsQuery.ts
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

/** Money as returned by your DTO (decimal string + currency) */
export interface Money {
  id?: string;
  amount: string;
  currency: string;
}

export type PaymentState = "COMPLETED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export interface TransactionSummary {
  transactionId: string;
  dateTime: string;
  serviceMerchantId: string;
  cardId: string | null;
  paymentId: string | null;
  paymentState: PaymentState;
  paymentAmount: Money | null;
  payerFirstName: string | null;
  payerLastName: string | null;
  payerEmail: string | null;
}

export interface Pageable {
  pageNumber: number;
  pageSize: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

export interface TransactionsResponse {
  content: TransactionSummary[];
  pageable: Pageable;
  last: boolean;
  totalElements: number;
  totalPages: number;
  first: boolean;
  numberOfElements: number;
  size: number;
  number: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
  empty: boolean;
}

const DEFAULT_BASE_URL = "http://localhost:8080";

export interface FetchTransactionsParams {
  page?: number; // 0-based
  size?: number;
  baseUrl?: string;
  serviceMerchantId?: string;
  paymentState?: PaymentState;
  paymentId?: string;
  cardId?: string;
  auth?:
    | { type: "bearer"; token?: string } // defaults to localStorage.accessToken
    | { type: "basic"; username: string; password: string };
}

function buildUrl({
  baseUrl = DEFAULT_BASE_URL,
  page = 0,
  size = 20,
  serviceMerchantId,
  paymentState,
  paymentId,
  cardId,
}: Required<Pick<FetchTransactionsParams, "baseUrl" | "page" | "size">> &
  Omit<FetchTransactionsParams, "baseUrl" | "page" | "size" | "auth">) {
  const url = new URL("/api/transactions", baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));

  if (serviceMerchantId) url.searchParams.set("serviceMerchantId", serviceMerchantId);
  if (paymentState) url.searchParams.set("paymentState", paymentState);
  if (paymentId) url.searchParams.set("paymentId", paymentId);
  if (cardId) url.searchParams.set("cardId", cardId);

  return url.toString();
}

export async function fetchTransactions(params: FetchTransactionsParams = {}): Promise<TransactionsResponse> {
  const {
    baseUrl = DEFAULT_BASE_URL,
    page = 0,
    size = 20,
    serviceMerchantId,
    paymentState,
    paymentId,
    cardId,
    auth = { type: "bearer" as const },
  } = params;

  const url = buildUrl({ baseUrl, page, size, serviceMerchantId, paymentState, paymentId, cardId });

  const headers: Record<string, string> = { Accept: "application/json" };
  let axiosConfig: any = { headers };

  if (auth.type === "bearer") {
    const token = auth.token ?? localStorage.getItem("accessToken");
    if (!token) throw new Error("No access token found");
    axiosConfig.headers.Authorization = `Bearer ${token}`;
  } else {
    axiosConfig = { ...axiosConfig, auth: { username: auth.username, password: auth.password } };
  }

  const { data } = await axios.get<TransactionsResponse>(url, axiosConfig);
  return data;
}

export interface UseTransactionsOptions extends FetchTransactionsParams {
  enabled?: boolean;
}

export function useTransactions(opts: UseTransactionsOptions = {}) {
  const {
    enabled = true,
    page = 0,
    size = 20,
    baseUrl = DEFAULT_BASE_URL,
    serviceMerchantId,
    paymentState,
    paymentId,
    cardId,
    auth = { type: "bearer" as const },
  } = opts;

  return useQuery<TransactionsResponse, Error>({
    queryKey: [
      "transactions",
      { page, size, baseUrl, serviceMerchantId, paymentState, paymentId, cardId, auth },
    ],
    queryFn: () =>
      fetchTransactions({ page, size, baseUrl, serviceMerchantId, paymentState, paymentId, cardId, auth }),
    enabled,
  });
}
