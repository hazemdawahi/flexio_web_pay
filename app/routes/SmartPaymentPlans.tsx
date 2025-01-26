// app/routes/SmartPaymentPlans.tsx
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalculatePaymentPlanRequest, useCalculatePaymentPlan } from '~/hooks/useCalculatePaymentPlan';
import { usePlaidTokensStatus } from '~/hooks/usePlaidTokens';
import { useUserDetails } from '~/hooks/useUserDetails';
import { toast, Toaster } from 'sonner';
import PaymentCircle from '~/compoments/PaymentCircle';

const safeParse = (value: string | string[] | undefined): number =>
  typeof value === 'string' ? parseFloat(value) : 0;

interface SmartPaymentPlansProps {
  merchantId?: string;
  amount?: string;
  instantPowerAmount?: string;
  superchargeDetails?: string;
}

const SmartPaymentPlans: React.FC<SmartPaymentPlansProps> = (props) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const merchantId = props.merchantId || searchParams.get('merchantId') || '';
  const amount = props.amount || searchParams.get('amount') || '0';
  const instantPowerAmount = props.instantPowerAmount || searchParams.get('instantPowerAmount') || '0';
  const superchargeDetailsParam = props.superchargeDetails || searchParams.get('superchargeDetails') || '';

  let superchargeList: any[] = [];
  if (superchargeDetailsParam) {
    try {
      superchargeList = JSON.parse(superchargeDetailsParam as string);
      console.log("Supercharge Details:", superchargeList);
    } catch (e) {
      console.error("Error parsing superchargeDetails:", e);
    }
  }

  const purchaseAmount = safeParse(amount);
  const instantPower = safeParse(instantPowerAmount);

  const frequency: 'MONTHLY' | 'BIWEEKLY' = 'MONTHLY';
  const numberOfPayments: number = 12;

  // Memoize planRequest to prevent it from being recreated on every render
  const planRequest: CalculatePaymentPlanRequest = useMemo(() => ({
    frequency,
    numberOfPayments,
    purchaseAmount,
    // Optionally include startDate if required
    // startDate: new Date().toISOString().split("T")[0],
  }), [frequency, numberOfPayments, purchaseAmount]);

  const {
    mutate: calculatePlan,
    data: calculateData,
    status,
    error,
  } = useCalculatePaymentPlan();

  const { data: plaidStatus, isLoading: plaidLoading, isError: plaidError } =
    usePlaidTokensStatus();

  const { data: userDetails, isLoading: userLoading, isError: userError } =
    useUserDetails();

  useEffect(() => {
    if (
      plaidStatus?.success &&
      plaidStatus?.data &&
      userDetails?.success &&
      userDetails?.data?.user.smartPay
    ) {
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log("Payment plan calculated successfully:", calculateData);
        },
        onError: (error: Error) => {
          console.error("Error calculating payment plan:", error);
          toast.error('Failed to calculate the payment plan. Please try again.');
        },
      });
    }
    // It's important to include calculateData in onSuccess callback if needed
    // but avoid adding it to the dependency array to prevent re-triggering useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plaidStatus, userDetails, calculatePlan, planRequest]);

  useEffect(() => {
    if (status === 'error' && error) {
      window.alert(`Error: ${error.message}`);
    }
  }, [status, error]);

  const renderSplitPayment = (item: any) => {
    const dueDate = new Date(item.dueDate);
    const day = dueDate.getDate();
    const month = dueDate.toLocaleString('default', { month: 'long' });
    const percentage = item.percentage || 0;
    const amount = (item.amount / 100).toFixed(2);

    return (
      <PaymentCircle
        key={item.id || Math.random()}
        day={day}
        month={month}
        percentage={percentage}
        amount={amount}
      />
    );
  };

  const handleProceed = () => {
    navigate('/payment_confirmation', {
      state: {
        merchantId,
        amount,
        instantPowerAmount,
        paymentPlan: calculateData?.data?.splitPayments || [],
        superchargeDetails: superchargeDetailsParam,
      },
    });
  };

  if (plaidLoading || userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>
        <p className="mt-4 text-lg text-gray-700">Loading, please wait...</p>
      </div>
    );
  }

  if (
    plaidError ||
    !plaidStatus?.success ||
    !plaidStatus?.data ||
    userError ||
    !userDetails?.success ||
    !userDetails?.data?.user.smartPay
  ) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <p className="text-red-500 text-center text-lg">
          Smart Payment Plans are disabled. Please ensure your financial data and Smart Pay settings are enabled.
        </p>
      </div>
    );
  }

  if (status === 'pending' || status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>
        <p className="mt-4 text-lg text-gray-700">Calculating payment plan, please wait...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <p className="text-red-500 text-center text-lg">
          Failed to calculate payment plan. Please try again.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 p-4 bg-white min-h-screen">
        {/* Summary Header */}
        <div className="px-4 mb-4">
          <h1 className="text-2xl font-bold text-black">Summary</h1>
        </div>

        {/* Summary Details */}
        <div className="bg-white p-4 rounded-lg mx-4 mb-4 shadow">
          <p className="text-lg text-gray-800 mb-2">
            <span className="font-bold text-black">Number of Payments: </span>
            {numberOfPayments}
          </p>
          <p className="text-lg text-gray-800">
            <span className="font-bold text-black">Total Amount: </span>
            ${(purchaseAmount / 100).toFixed(2)}
          </p>
        </div>

        {/* Split Payments List */}
        <div className="flex overflow-x-auto py-4 px-2">
          {calculateData?.data?.splitPayments?.map(renderSplitPayment)}
        </div>

        {/* Proceed Button */}
        <button
          className="fixed bottom-4 left-4 right-4 bg-black text-white font-bold py-4 rounded-lg"
          onClick={handleProceed}
        >
          Proceed to Confirmation
        </button>
      </div>

      {/* Toast Container */}
      <Toaster richColors />
    </>
  );
};

export default SmartPaymentPlans;
