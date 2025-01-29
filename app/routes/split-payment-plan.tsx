// src/routes/SplitPaymentPlan.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import PaymentPlanMocking from '~/compoments/PaymentPlanMocking'; // Corrected import path
import PaymentMethodItem from '~/compoments/PaymentMethodItem'; // Corrected import path

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

interface OtherUserAmount {
  userId: string;
  amount: string; // amount in cents
}

interface SplitPaymentPlanProps {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: OtherUserAmount[];
  paymentMethodId: string;
}

type PaymentFrequency = 'BIWEEKLY' | 'MONTHLY';

const SplitPaymentPlan: React.FC<SplitPaymentPlanProps> = ({
  instantPowerAmount,
  superchargeDetails,
  otherUserAmounts,
  paymentMethodId,
}) => {
  const navigate = useNavigate();

  // Convert instantPowerAmount to dollars
  const instantPowerAmountValue = Number(instantPowerAmount) / 100 || 0;

  // State for user-selected number of periods and payment frequency
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>('1'); // Adjusted to 1 as per desired structure
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MONTHLY'); // Fixed to 'MONTHLY'

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
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
        onSuccess: (data) => {
          console.log('Payment plan calculated successfully:', data);
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

  // Handle errors or success from calculatePlan
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

  // Render the payment method section
  const renderPaymentMethodSection = () => {
    if (paymentMethodsStatus === 'pending') { // Changed 'pending' to 'loading' if using React Query
      return (
        <div className="flex justify-center items-center">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
        </div>
      );
    }

    if (paymentMethodsStatus === 'error') {
      return <p className="text-red-500">Error fetching payment methods</p>;
    }

    return (
      <SelectedPaymentMethod
        selectedMethod={selectedPaymentMethod}
        onPress={() => setIsModalOpen(true)}
      />
    );
  };

  // Handle confirmation of the payment plan
  const handleConfirm = () => {
    if (!selectedPaymentMethod || instantPowerAmountValue === 0) {
      toast.error('Please select a payment method and ensure the amount is greater than $0.');
      return;
    }

    setIsLoading(true);

    // Simulating a successful confirmation
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Payment plan confirmed successfully!');
      navigate('/payment_confirmation', {
        state: {
          instantPowerAmount,
          superchargeDetails,
          paymentFrequency,
          offsetStartDate: planRequest.startDate,
          numberOfPayments: planRequest.numberOfPayments,
          otherUserAmounts,
          paymentPlan: calculatedPlan?.data?.splitPayments || [],
        },
      });

      console.log("State Passed:", {
        instantPowerAmount,
        superchargeDetails,
        paymentFrequency,
        offsetStartDate: planRequest.startDate,
        numberOfPayments: planRequest.numberOfPayments,
        otherUserAmounts,
      });
    }, 1500);
  };

  // Generate number of periods options based on frequency
  const getMaxNumber = (frequency: PaymentFrequency): number => {
    return frequency === 'BIWEEKLY' ? 26 : 12;
  };

  const getNumberOptions = () => {
    const maxNumber = getMaxNumber(paymentFrequency);
    return Array.from({ length: maxNumber }, (_, index) => (
      <option key={index + 1} value={`${index + 1}`}>
        {index + 1}
      </option>
    ));
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
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center mb-5">
          <div>
            <h1 className="text-2xl font-bold text-black">
              Flex your payments for ${instantPowerAmountValue.toFixed(2)}
            </h1>
          </div>
        </div>

        {/* Pickers */}
        <div className="flex flex-col md:flex-row items-center mb-5 space-y-4 md:space-y-0 md:space-x-4">
          {/* Number of Periods Picker */}
          <div className="w-full md:w-1/2">
            <label htmlFor="numberOfPeriods" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Periods
            </label>
            <select
              id="numberOfPeriods"
              value={numberOfPeriods}
              onChange={(e) => setNumberOfPeriods(e.target.value)}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {getNumberOptions()}
            </select>
          </div>

          {/* Payment Frequency Picker */}
          <div className="w-full md:w-1/2">
            <label htmlFor="paymentFrequency" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Frequency
            </label>
            <select
              id="paymentFrequency"
              value={paymentFrequency}
              onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
              disabled={numberOfPeriods === '1'} // Disable if only 1 period
              className={`block w-full p-2 border ${
                numberOfPeriods === '1' ? 'bg-gray-100' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        {/* Payment Plan */}
        {instantPowerAmountValue > 0 && (
          <div className="mb-5">
            <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
            {isPlanLoading ? (
              <div className="flex justify-center items-center">
                <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
              </div>
            ) : (
              <PaymentPlanMocking
                payments={mockPayments}
                showChangeDateButton={true}
                isCollapsed={false}
              />
            )}
          </div>
        )}

        {/* Payment Method */}
        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">Payment Method</h2>
          {renderPaymentMethodSection()}
        </div>

        {/* Confirm Button */}
        <button
          className={`w-full bg-black text-white font-bold py-3 rounded-lg ${
            instantPowerAmountValue === 0 || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'hover:bg-gray-800'
          }`}
          onClick={instantPowerAmountValue > 0 ? handleConfirm : undefined}
          disabled={instantPowerAmountValue === 0 || isLoading}
        >
          {isLoading ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {instantPowerAmountValue > 0
                ? `Flex $${instantPowerAmountValue.toFixed(2)}`
                : "Flex your payments"}
            </span>
          )}
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

export default SplitPaymentPlan;
