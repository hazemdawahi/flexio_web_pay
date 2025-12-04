import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

// Base URL
const BASE_URL = 'http://localhost:8080'

// --- Response Interfaces ---

export interface SplitPaymentDue {
  id: string
  amount: number
  dueDate: string
  declaredExpectedPayDate: string | null
  declaredReason: string | null
  declaredExplanation: string | null
  paidStatus: string
  paymentDate: string | null
  paymentMethodId: string | null
  late: boolean
  lateDeclared: boolean
  extensionCount: number
  paymentIntentId: string | null
  defaulted: boolean
  partPay: boolean
  slidableCount: number
  refunds: any[]
  createdAt: string
  updatedAt: string
}

export interface RentDue {
  rentAmount: number
  rentDueDate: string
}

export interface Cycle {
  cycleLabel: string
  startDate: string
  endDate: string
  plannedPaymentDate: string
  incomeAmount: number
  creditLiabilitiesDue: any[]
  splitPaymentsDue: SplitPaymentDue[]
  rentDue: RentDue | null
  totalAmount: number
  allocatedPayment: number
  percentage: number
}

export interface SmartpayPlanResponse {
  purchaseAmount: number
  termMonths: number
  modelType: string
  mae: number
  cycles: Cycle[]
}

// --- Axios Instance ---

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
  },
})

// --- Fetch Function ---

/**
 * Fetches the smart-pay plan for a given price.
 * @param price the purchase price to plan for
 * @param token the user's JWT
 */
async function fetchSmartpayPlanData(
  price: number,
  token: string
): Promise<SmartpayPlanResponse> {
  const response = await axiosInstance.get<SmartpayPlanResponse>(
    '/api/smartpay/plan',
    {
      params: { price },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  console.log('Smartpay plan response:', response.data)
  return response.data
}

// --- React Query Hook ---

/**
 * Custom hook to fetch smart-pay plan data.
 * Only runs if an access token is found in sessionStorage.
 */
export function useSmartpayPlan(price: number) {
  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('accessToken')
    : null

  return useQuery<SmartpayPlanResponse, Error>({
    queryKey: ['smartpayPlan', price, token],
    queryFn: () => {
      if (!token) {
        throw new Error('No access token available')
      }
      return fetchSmartpayPlanData(price, token)
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    retry: 3,
  })
}
