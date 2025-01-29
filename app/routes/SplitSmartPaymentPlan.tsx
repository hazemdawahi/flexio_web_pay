// src/routes/SplitSmartPaymentPlan.tsx

import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@remix-run/react'; // Ensure correct import based on your routing library
import {
  usePaymentMethods,
  PaymentMethod,
} from '~/hooks/usePaymentMethods';
import {
  useCalculatePaymentPlan,
  SplitPayment,
  CalculatePaymentPlanRequest,
} from '~/hooks/useCalculatePaymentPlan';
import { useUserDetails } from '~/hooks/useUserDetails';
import { Dialog } from '@headlessui/react';
import { toast, Toaster } from 'sonner';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod'; // Corrected import path
import PaymentMethodItem from '~/compoments/PaymentMethodItem'; // Corrected import path
import PaymentCircle from '~/compoments/PaymentCircle'; // Ensure this component exists

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

interface OtherUserAmount {
  userId: string;
  amount: string; // amount in cents
}

interface SplitSmartPaymentPlanProps {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: OtherUserAmount[]; // Included otherUserAmounts
  paymentMethodId: string;
}

type PaymentFrequency = 'BIWEEKLY' | 'MONTHLY';

const SplitSmartPaymentPlan: React.FC<SplitSmartPaymentPlanProps> = ({
  instantPowerAmount,
  superchargeDetails,
  otherUserAmounts, // Destructured otherUserAmounts
  paymentMethodId,
}) => {
  const navigate = useNavigate();

  // Convert instantPowerAmount to dollars
  const instantPowerAmountValue = Number(instantPowerAmount) / 100 || 0;

  // Fixed number of periods and payment frequency for Smart Payment Plans
  const numberOfPeriods = '12';
  const paymentFrequency: PaymentFrequency = 'MONTHLY'; // Fixed to 'MONTHLY'

  const [isPlanLoading, setIsPlanLoading] = React.useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: isUserDetailsLoading, isError: isUserDetailsError, error: userDetailsError } = useUserDetails();

  // Mapping from PaymentFrequency to API expected format
  const frequencyMap: Record<PaymentFrequency, 'BIWEEKLY' | 'MONTHLY'> = {
    'BIWEEKLY': 'BIWEEKLY',
    'MONTHLY': 'MONTHLY',
  };

  // Memoize planRequest to prevent it from being recreated on every render
  const planRequest: CalculatePaymentPlanRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: instantPowerAmountValue * 100, // Convert dollars back to cents
      startDate: new Date().toISOString().split('T')[0],
      otherUserAmounts: otherUserAmounts.map(user => ({
        userId: user.userId,
        amount: Number(user.amount),
      })),
      superchargeDetails: superchargeDetails.map(detail => ({
        amount: Number(detail.amount),
        paymentMethodId: detail.paymentMethodId,
      })),
    }),
    [paymentFrequency, numberOfPeriods, instantPowerAmountValue, superchargeDetails, otherUserAmounts]
  );

  // Set default payment method if not selected
  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      // If paymentMethodId is provided, select it; otherwise, select the first one
      if (paymentMethodId) {
        const method = paymentMethodsData.data.data.find((m: PaymentMethod) => m.id === paymentMethodId);
        if (method) {
          setSelectedPaymentMethod(method);
        } else {
          setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
        }
      } else {
        setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
      }
    }
  }, [paymentMethodsData, selectedPaymentMethod, paymentMethodId]);

  // Calculate the payment plan when dependencies change
  useEffect(() => {
    if (instantPowerAmountValue > 0) {
      setIsPlanLoading(true);
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log('Payment plan calculated successfully:', calculatedPlan);
          setIsPlanLoading(false);
        },
        onError: (error: Error) => {
          console.error('Error calculating payment plan:', error);
          setIsPlanLoading(false);
          toast.error('Failed to calculate the payment plan. Please try again.');
        },
      });
    }
    // Removed 'calculatedPlan' from dependencies to prevent infinite loop
  }, [calculatePlan, planRequest, instantPowerAmountValue]);

  // Handle errors from calculatePlan
  useEffect(() => {
    if (calculatePlanError) {
      console.error('Error calculating payment plan:', calculatePlanError);
      setIsPlanLoading(false);
      toast.error('Unable to calculate the payment plan. Please try again later.');
    } else if (calculatedPlan?.data) {
      console.log('Calculated Plan:', calculatedPlan.data);
      setIsPlanLoading(false);
    }
  }, [calculatedPlan, calculatePlanError]);

  // Prepare mock payments for display
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments?.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(((payment.amount / (instantPowerAmountValue * 100)) * 100).toFixed(2)),
    })) || [];

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setIsModalOpen(false);
  }, []);



  // Handle proceeding to confirmation
  const handleProceed = () => {
    if (!calculatedPlan?.data) {
      toast.error('Payment plan data is not available.');
      return;
    }

    navigate('/payment_confirmation', {
      state: {
        instantPowerAmount,
        superchargeDetails,
        paymentFrequency,
        offsetStartDate: planRequest.startDate,
        numberOfPayments: planRequest.numberOfPayments,
        otherUserAmounts,
      },
    });

    console.log("State Passed:", {
      instantPowerAmount,
      superchargeDetails,
      paymentFrequency,
      offsetStartDate: planRequest.startDate,
      numberOfPayments: planRequest.numberOfPayments,
      otherUserAmounts,
      paymentPlan: calculatedPlan.data.splitPayments,
    });
  };

  // Determine overall loading state
  const isLoadingState = isPlanLoading || isUserDetailsLoading;

  // Determine error state
  const isErrorState = calculatePlanError || isUserDetailsError || !userDetailsData?.data?.user.smartPay;

  if (isLoadingState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>
        <p className="mt-4 text-lg text-gray-700">Calculating payment plan, please wait...</p>
      </div>
    );
  }

  if (isErrorState) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <p className="text-red-500 text-center text-lg">
          Smart Payment Plans are disabled. Please ensure your financial data and Smart Pay settings are enabled.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 p-4 bg-white min-h-screen">
        {/* Summary Header */}
        <div className="px-4 mb-4">
          <h1 className="text-2xl font-bold text-black">Smart Payment Plan Summary</h1>
        </div>

        {/* Summary Details */}
        <div className="bg-white p-4 rounded-lg mx-4 mb-4 shadow">
          <p className="text-lg text-gray-800 mb-2">
            <span className="font-bold text-black">Number of Payments: </span>
            {numberOfPeriods}
          </p>
          <p className="text-lg text-gray-800 mb-2">
            <span className="font-bold text-black">Payment Frequency: </span>
            {paymentFrequency}
          </p>
          <p className="text-lg text-gray-800">
            <span className="font-bold text-black">Total Amount: </span>
            ${(instantPowerAmountValue).toFixed(2)}
          </p>
        </div>

        {/* Split Payments List */}
        <div className="flex flex-row overflow-x-auto py-4 px-2 space-x-4">
          {mockPayments.map((payment, index) => (
            <PaymentCircle
              key={index}
              day={new Date(payment.dueDate).getDate()}
              month={new Date(payment.dueDate).toLocaleString('default', { month: 'long' })}
              percentage={payment.percentage}
              amount={(payment.amount / 100).toFixed(2)}
            />
          ))}
        </div>

        {/* Proceed Button */}
        <button
          className="w-full bg-black text-white font-bold py-4 rounded-lg hover:bg-gray-800 transition"
          onClick={handleProceed}
        >
          Proceed to Confirmation
        </button>
      </div>

      {/* Payment Methods Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black opacity-30" />

          <Dialog.Panel className="bg-white rounded-lg max-w-md mx-auto z-20 w-full p-6">
            <Dialog.Title className="text-lg font-bold mb-4">Select Payment Method</Dialog.Title>
            <div className="max-h-80 overflow-y-auto">
              {paymentMethodsData?.data?.data?.map((method: PaymentMethod) => (
                <PaymentMethodItem
                  key={method.id}
                  method={method}
                  selectedMethod={selectedPaymentMethod}
                  onSelect={handleMethodSelect}
                />
              ))}
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-4 w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600"
            >
              Close
            </button>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Toast Container */}
      <Toaster richColors />
    </>
  );
};

export default SplitSmartPaymentPlan;
