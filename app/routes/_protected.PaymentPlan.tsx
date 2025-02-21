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
import { useCompleteCheckout, CompleteCheckoutPayload } from '~/hooks/useCompleteCheckout';

const SERVER_BASE_URL = 'http://192.168.1.32:8080';

// Convert a dollar string (e.g. "50.00") into cents (e.g. 5000)
const convertDollarStringToCents = (amount: string): number => {
  const [dollars, cents = ""] = amount.split(".");
  const paddedCents = cents.padEnd(2, "0").slice(0, 2);
  return parseInt(dollars + paddedCents, 10);
};

// If the string contains a dot, assume it's a dollar value with decimals;
// otherwise, assume it's already in cents.
const getCents = (amount: string): number =>
  amount.includes(".") ? convertDollarStringToCents(amount) : Number(amount);

// For display purposes, if the string contains a dot it's already dollars;
// otherwise, we assume it's in cents and divide by 100.
const formatDollarAmount = (amount: string): number =>
  amount.includes(".") ? parseFloat(amount) : parseInt(amount, 10) / 100;

// Define a type for other user amounts
interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string; // amount in cents as a string (e.g., "50000" for $500.00)
  paymentMethodId: string;
}

interface PaymentPlanProps {
  instantPowerAmount: string; // in cents as a string (or dollars if a dot is present, e.g. "50.00")
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

  // For display, use formatDollarAmount so that "50.00" or "5000" become $50.00.
  const displayedInstantPowerAmount = formatDollarAmount(instantPowerAmount) || 0;
  // For checkout payload, always work with the cent value.
  const purchaseAmountCents = getCents(instantPowerAmount);

  // Local states for payment plan options
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>('1');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Selected payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  // Retrieve checkout token from sessionStorage
  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // Mapping from PaymentFrequency to API expected format
  const frequencyMap: Record<PaymentFrequency, 'BIWEEKLY' | 'MONTHLY'> = {
    BIWEEKLY: 'BIWEEKLY',
    MONTHLY: 'MONTHLY',
  };

  // Build the plan request.
  // NOTE: Here we pass the purchase amount in dollars (using displayedInstantPowerAmount)
  // so that a $50.00 flex is treated as 50, not 5000.
  const planRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: displayedInstantPowerAmount, // in dollars
      startDate: startDate,
    }),
    [paymentFrequency, numberOfPeriods, displayedInstantPowerAmount, startDate]
  );

  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  useEffect(() => {
    if (displayedInstantPowerAmount > 0) {
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log('Payment plan calculated successfully:', calculatedPlan);
        },
        onError: (error: Error) => {
          console.error('Error calculating payment plan:', error);
          toast.error('Failed to calculate the payment plan. Please try again.');
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFrequency, numberOfPeriods, displayedInstantPowerAmount, startDate, calculatePlan]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error('Error calculating payment plan:', calculatePlanError);
      toast.error('Unable to calculate the payment plan. Please try again later.');
    } else if (calculatedPlan?.data) {
      console.log('Calculated Plan:', calculatedPlan.data);
    }
  }, [calculatedPlan, calculatePlanError]);

  // Build splitPayments for UI display.
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(
        ((payment.amount / displayedInstantPowerAmount) * 100).toFixed(2)
      ),
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

  // Use the complete checkout mutation hook.
  const { mutate: completeCheckout, status: checkoutStatus, error: checkoutError } = useCompleteCheckout();

  const handleConfirm = () => {
    if (!selectedPaymentMethod || purchaseAmountCents === 0) {
      toast.error('Please select a payment method and ensure the amount is greater than zero.');
      return;
    }
    if (!checkoutToken) {
      toast.error('Checkout token is missing. Please try again.');
      return;
    }

    const numberOfPayments = parseInt(numberOfPeriods, 10);
    // Use the raw cent value for the payload.
    const instantAmount = purchaseAmountCents;
    const yearlyAmount = instantAmount * numberOfPayments;

    // Transform supercharge details using the same conversion logic.
    const transformedSuperchargeDetails = superchargeDetails.map(detail => ({
      paymentMethodId: detail.paymentMethodId,
      amount: getCents(detail.amount),
    }));

    // Build the payload—all amounts in cents.
    const payload: CompleteCheckoutPayload = {
      checkoutToken: checkoutToken,
      instantAmount,
      yearlyAmount,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: transformedSuperchargeDetails,
      paymentFrequency: paymentFrequency,
      numberOfPayments: numberOfPayments,
      offsetStartDate: startDate,
      otherUsers: otherUserAmounts.map(user => ({
        userId: user.userId,
        amount: getCents(user.amount),
      })),
    };

    completeCheckout(payload, {
      onSuccess: (data) => {
        console.log('Checkout successful:', data);
        const targetWindow = window.opener || window.parent || window;
        // Check if otherUserAmounts has any entries.
        if (otherUserAmounts && otherUserAmounts.length > 0) {
          targetWindow.postMessage(
            {
              status: "PENDING",
              checkoutToken,
              data,
            },
            "*"
          );
          toast.success('Payment plan confirmed for other user amounts. Payment is pending!');
        } else {
          targetWindow.postMessage(
            {
              status: "COMPLETED",
              checkoutToken,
              data,
            },
            "*"
          );
          toast.success('Payment plan confirmed successfully!');
        }
      },
      onError: (error: Error) => {
        console.error('Error during checkout:', error);
        toast.error('Failed to complete checkout. Please try again.');
      },
    });
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

  // Filter card-type payment methods.
  const cardMethods: PaymentMethod[] =
    paymentMethodsData?.data?.data?.filter(
      (method: PaymentMethod) => method.type === "card"
    ) || [];

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center mb-5">
          <h1 className="text-2xl font-bold text-black">
            Flex your payments for ${displayedInstantPowerAmount.toFixed(2)}
          </h1>
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
              className={`block w-full p-2 border ${numberOfPeriods === '1' ? 'bg-gray-100' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        {/* Payment Plan Section */}
        {displayedInstantPowerAmount > 0 && (
          <div className="mb-5">
            <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
            {calculatedPlan?.data ? (
              <PaymentPlanMocking
                payments={mockPayments}
                showChangeDateButton={true}
                isCollapsed={false}
                initialDate={new Date(startDate)}
                onDateSelected={(date: Date) => {
                  setStartDate(date.toISOString().split("T")[0]);
                }}
              />
            ) : (
              <div className="flex justify-center items-center">
                <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
              </div>
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
          className={`w-full bg-black text-white font-bold py-3 rounded-lg ${purchaseAmountCents === 0 || checkoutStatus === "pending" ? "bg-gray-400 cursor-not-allowed" : "hover:bg-gray-800"}`}
          onClick={handleConfirm}
          disabled={purchaseAmountCents === 0 || checkoutStatus === "pending"}
        >
          {checkoutStatus === "pending" ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {displayedInstantPowerAmount > 0
                ? `Flex $${displayedInstantPowerAmount.toFixed(2)}`
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
                <div className="flex justify-end p-4">
                  <button
                    onClick={() => navigate("/payment-settings")}
                    className="bg-black text-white font-bold py-2 px-4 rounded-lg"
                  >
                    Payment Settings
                  </button>
                </div>
                <h2 className="text-xl font-semibold mb-4 px-4">Select Payment Method</h2>
                <div className="space-y-4 px-4 pb-4">
                  {paymentMethodsData?.data?.data
                    ?.filter((method: PaymentMethod) => method.type === "card")
                    .map((method, index) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={handleMethodSelect}
                        isLastItem={index === paymentMethodsData.data.data.length - 1}
                      />
                    ))}
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
