import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

// Base URL
const BASE_URL = 'http://192.168.1.32:8080'

// --- Response Interfaces ---

export interface IncomeEvent {
  date: string
  amount: number
  provider: string
}

export interface LiabilityEvent {
  date: string
  amount: number
  type: string
}

export interface SplitPayment {
  date: string
  amount: number
  type: string
}

export interface RentEvent {          
  date: string
  amount: number
  type: string
}

export interface AvoidedDate {
  id: string
  startDate: string
  endDate: string
  name: string
}

export interface PlanEvent {
  plannedPaymentDate: string
  allocatedPayment: number
}

export interface FinancialCalendarPlanData {
  splitPayments: SplitPayment[]
  incomeEvents: IncomeEvent[]
  liabilityEvents: LiabilityEvent[]
  rentEvents: RentEvent[]            // ← added
  avoidedDates: AvoidedDate[]
  planEvents: PlanEvent[]
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
 * Fetches the financial calendar plan for a given price.
 * @param price the purchase price to plan for
 * @param token the user's JWT
 */
async function fetchFinancialCalendarPlanData(
  price: number,
  token: string
): Promise<FinancialCalendarPlanData> {
  const response = await axiosInstance.get<FinancialCalendarPlanData>(
    '/api/financial-calendar/plan',
    {
      params: { price },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  console.log('Plan response:', response.data)
  return response.data
}

// --- React Query Hook ---

/**
 * Custom hook to fetch financial calendar plan data.
 * Only runs if an access token is found in sessionStorage.
 */
export function useFinancialCalendarPlan(price: number) {
  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('accessToken')
    : null

  return useQuery<FinancialCalendarPlanData, Error>({
    queryKey: ['financialCalendarPlan', price, token],
    queryFn: () => {
      if (!token) {
        throw new Error('No access token available')
      }
      return fetchFinancialCalendarPlanData(price, token)
    },
    enabled: !!token,                // only run when token is truthy
    staleTime: 1000 * 60 * 5,        // cache for 5 minutes
    retry: 3,                        // retry up to 3 times on failure
  })
}
