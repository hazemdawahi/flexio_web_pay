import { useMutation, useQueryClient } from '@tanstack/react-query';

// Interface for request payload, updated with the optional `startDate`
export interface CalculatePaymentPlanRequest {
  frequency: 'MONTHLY' | 'BIWEEKLY';
  numberOfPayments: number;
  purchaseAmount: number; // In cents (e.g., 150000 for $1500.00)
  startDate?: string; // Optional start date in "YYYY-MM-DD" format
}

// Interface for split payments in the response, updated with `percentage`
export interface SplitPayment {
  amount: number;    // In cents (e.g., 12625 for $126.25)
  dueDate: string;   // ISO date string (e.g., "2024-01-01")
  percentage: number; // Percentage of the total payment (e.g., 8.33 for 8.33%)
}

// Interface for income and liability events in the financial calendar
export interface FinancialEvent {
  date: string;       // ISO date string (e.g., "2024-11-15")
  amount: number;     // In cents (e.g., 99667 for $996.67)
  provider?: string;  // Optional provider name for income events
  type?: string;      // Optional type for liability events (e.g., "mortgage", "student")
}

// Interface for the financial calendar
export interface FinancialCalendar {
  incomeEvents: FinancialEvent[];
  liabilityEvents: FinancialEvent[];
  avoidedDates?: string[]; // Avoided dates for scheduling payments, if any
}

// Interface for the API response, updated with `percentage` in `splitPayments` and other details
export interface CalculatePaymentPlanResponse {
  success: boolean;
  data: {
    totalAmount: number;
    splitPayments: SplitPayment[];
    offsetDays?: number; // Offset days for split payments
    financialCalendar?: FinancialCalendar; // Optional financial calendar details
  } | null;
  error: string | null;
}

// Function to calculate the payment plan using fetch
async function calculatePaymentPlan(planRequest: CalculatePaymentPlanRequest): Promise<CalculatePaymentPlanResponse> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  if (!token) {
    throw new Error('No access token found');
  }

  try {
    const response = await fetch('http://192.168.1.32:8080/api/payment-plans/calculate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
      },
      body: JSON.stringify(planRequest), // Convert planRequest object to JSON
    });

    if (!response.ok) {
      throw new Error(`Payment plan calculation failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as CalculatePaymentPlanResponse;

  } catch (error: any) {
    throw new Error(`Payment plan calculation failed: ${error.message}`);
  }
}

// Create the custom hook for calculating the payment plan
export function useCalculatePaymentPlan() {
  const queryClient = useQueryClient(); // Access the query client

  return useMutation<CalculatePaymentPlanResponse, Error, CalculatePaymentPlanRequest>({
    mutationFn: calculatePaymentPlan,
    onSuccess: () => {
      // Invalidate any queries related to payment plans, if needed
      queryClient.invalidateQueries({ queryKey: ['paymentPlans'] });
    },
    onError: (error) => {
      console.error('Payment plan calculation failed:', error.message);
    },
  });
}
