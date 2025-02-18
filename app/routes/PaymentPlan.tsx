// app/routes/payment-plan.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@remix-run/react';
import { usePaymentMethods, PaymentMethod } from '~/hooks/usePaymentMethods';
import { useCalculatePaymentPlan, SplitPayment } from '~/hooks/useCalculatePaymentPlan';
import { useUserDetails } from '~/hooks/useUserDetails';
import { toast, Toaster } from 'sonner';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod';
import PaymentPlanMocking from '~/compoments/PaymentPlanMocking';
import PaymentMethodItem from '~/compoments/PaymentMethodItem';
import { motion, AnimatePresence } from 'framer-motion';

const SERVER_BASE_URL = 'http://192.168.1.32:8080';

// Define a type for other user amounts
interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

interface PaymentPlanProps {
  instantPowerAmount: string; // expected in cents (e.g., "1000" for $10.00) or dollars if you adjust the logic below
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  otherUserAmounts?: SplitEntry[]; // Optional prop for other users' amounts
}

type PaymentFrequency = 'BIWEEKLY' | 'MONTHLY';

const PaymentPlan: React.FC<PaymentPlanProps> = ({
  instantPowerAmount,
  superchargeDetails,
  paymentMethodId,
  otherUserAmounts = [],
}) => {
  const navigate = useNavigate();

  // Debug: Log the received prop
  console.log("Received instantPowerAmount prop:", instantPowerAmount);

  // If your parent passes the amount in cents, use the following line:
  const instantPowerAmountValue = Number(instantPowerAmount) / 100 || 0;
  
  // If the parent now passes the amount in dollars, use this instead:
  // const instantPowerAmountValue = Number(instantPowerAmount) || 0;

  // State for number of periods and payment frequency
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>('1');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MONTHLY');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  // Retrieve checkoutToken from sessionStorage
  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // New state: starting date for the payment plan (in YYYY-MM-DD format)
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Mapping from PaymentFrequency to API expected format
  const frequencyMap: Record<PaymentFrequency, 'BIWEEKLY' | 'MONTHLY'> = {
    BIWEEKLY: 'BIWEEKLY',
    MONTHLY: 'MONTHLY',
  };

  // Memoize planRequest with the current starting date.
  const planRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      // If your API expects the purchase amount in cents:
      purchaseAmount: instantPowerAmountValue * 100,
      // If your API expects the amount in dollars, use:
      // purchaseAmount: instantPowerAmountValue,
      startDate: startDate,
    }),
    [paymentFrequency, numberOfPeriods, instantPowerAmountValue, startDate]
  );

  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFrequency, numberOfPeriods, instantPowerAmountValue, startDate, calculatePlan]);

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

  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(((payment.amount / (instantPowerAmountValue * 100)) * 100).toFixed(2)),
    })) || [];

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setIsModalOpen(false);
  }, []);

  const renderPaymentMethodSection = () => {
    if (paymentMethodsStatus === 'pending') {
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

  const handleConfirm = () => {
    if (!selectedPaymentMethod || instantPowerAmountValue === 0) {
      toast.error('Please select a payment method and ensure the amount is greater than zero.');
      return;
    }

    if (!checkoutToken) {
      toast.error('Checkout token is missing. Please try again.');
      return;
    }

    const offsetStartDate = planRequest.startDate;
    const numberOfPayments = parseInt(numberOfPeriods, 10);
    setIsLoading(true);

    // Log the other users' amounts when the user presses Flex
    console.log("Other User Amounts:", otherUserAmounts);

    setTimeout(() => {
      setIsLoading(false);
      toast.success('Payment plan confirmed successfully!');
      navigate('/payment-success', {
        state: {
          instantPowerAmount,
          superchargeDetails,
          paymentFrequency,
          offsetStartDate,
          numberOfPayments,
          // Pass only the selected payment method's id
          selectedPaymentMethod: selectedPaymentMethod.id,
          checkoutToken,
          otherUserAmounts, // Sending otherUserAmounts along with the state
        },
      });
      console.log("State sent to /payment-success", {
        instantPowerAmount,
        superchargeDetails,
        paymentFrequency,
        offsetStartDate,
        numberOfPayments,
        selectedPaymentMethod: selectedPaymentMethod.id,
        checkoutToken,
        otherUserAmounts,
      });
    }, 1500);
  };

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

  // Filter card-type payment methods (exclude bank accounts)
  const cardMethods: PaymentMethod[] =
    paymentMethodsData?.data?.data?.filter(
      (method: PaymentMethod) => method.type === "card"
    ) || [];

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
              disabled={numberOfPeriods === '1'}
              className={`block w-full p-2 border ${
                numberOfPeriods === '1' ? 'bg-gray-100' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        {/* Payment Plan Section */}
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
                // Pass the current startDate (as a Date object) to PaymentPlanMocking.
                initialDate={new Date(startDate)}
                onDateSelected={(date: Date) => {
                  setStartDate(date.toISOString().split("T")[0]);
                }}
              />
            )}
          </div>
        )}

        {/* Payment Method Section */}
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

      {/* Animated Payment Methods Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-3/4 overflow-y-auto"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <h2 className="text-lg font-bold mb-4">Select Payment Method</h2>
                  <div className="max-h-80 overflow-y-auto">
                    {cardMethods.map((method: PaymentMethod, index: number) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={handleMethodSelect}
                        isLastItem={cardMethods.length === 1 || index === cardMethods.length - 1}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster richColors />
    </>
  );
};

export default PaymentPlan;
