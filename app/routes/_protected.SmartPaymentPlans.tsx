import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@remix-run/react';
import {
  CalculatePaymentPlanRequest,
  useCalculatePaymentPlan,
  SplitPayment,
} from '~/hooks/useCalculatePaymentPlan';
import { usePlaidTokensStatus } from '~/hooks/usePlaidTokens';
import { useUserDetails } from '~/hooks/useUserDetails';
import { toast, Toaster } from 'sonner';
import { Dialog } from '@headlessui/react';
import { PaymentMethod, usePaymentMethods } from '~/hooks/usePaymentMethods';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod';
import PaymentMethodItem from '~/compoments/PaymentMethodItem';
import PaymentCircle from '~/compoments/PaymentCircle';
import { useCompleteCheckout, CompleteCheckoutPayload } from '~/hooks/useCompleteCheckout';

const SERVER_BASE_URL = 'http://192.168.1.32:8080';

// Helper function to convert a dollar string to an integer value in cents.
// For example, "50.00" becomes 5000.
const convertDollarStringToCents = (amount: string): number => {
  const [dollars, cents = ""] = amount.split(".");
  const paddedCents = cents.padEnd(2, "0").slice(0, 2);
  return parseInt(dollars + paddedCents, 10);
};

// For each amount input, if it contains a decimal point we assume it's in dollars and convert to cents;
// otherwise we assume it's already in cents.
const getCents = (amount: string): number =>
  amount.includes('.') ? convertDollarStringToCents(amount) : Number(amount);

// Define a type for other user amounts
interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string; // amount in dollars as entered by the user (e.g., "50.00") or in cents if no decimal is present
  paymentMethodId: string;
}

interface SmartPaymentPlansProps {
  instantPowerAmount: string; // in dollars as entered by the user (e.g., "500.00") or in cents (e.g., "50000")
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  otherUserAmounts?: SplitEntry[]; // Optional prop for other users' amounts
}

type PaymentFrequency = 'monthly' | 'bi-weekly';

const SmartPaymentPlans: React.FC<SmartPaymentPlansProps> = ({
  instantPowerAmount,
  superchargeDetails,
  paymentMethodId,
  otherUserAmounts = [],
}) => {
  const navigate = useNavigate();

  // Determine the raw cent value:
  const instantPowerAmountCents = getCents(instantPowerAmount);
  // For display purposes, convert cents to dollars.
  const instantPowerAmountValue = instantPowerAmountCents / 100;

  // Fixed values for this route
  const numberOfPeriods = '12';
  const paymentFrequency: PaymentFrequency = 'monthly';

  const [isPlanLoading, setIsPlanLoading] = React.useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);

  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: plaidStatus, isLoading: plaidLoading, isError: plaidError } = usePlaidTokensStatus();
  const { data: userDetails, isLoading: userLoading, isError: userError } = useUserDetails();

  // Retrieve checkoutToken from sessionStorage
  const checkoutToken = sessionStorage.getItem('checkoutToken');

  // Mapping from our PaymentFrequency to the API expected format
  const frequencyMap: Record<PaymentFrequency, 'BIWEEKLY' | 'MONTHLY'> = {
    'bi-weekly': 'BIWEEKLY',
    'monthly': 'MONTHLY',
  };

  // Build the plan request – the API expects purchaseAmount in cents.
  const planRequest: CalculatePaymentPlanRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: getCents(instantPowerAmount),
      startDate: new Date().toISOString().split('T')[0],
    }),
    [paymentFrequency, numberOfPeriods, instantPowerAmount]
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
  }, [paymentFrequency, numberOfPeriods, instantPowerAmountValue, calculatePlan]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error('Error calculating payment plan:', calculatePlanError);
      setIsPlanLoading(false);
      toast.error('Unable to calculate the payment plan. Please try again later.');
    }
  }, [calculatePlanError]);

  const getMaxNumber = (frequency: PaymentFrequency): number => {
    return frequency === 'bi-weekly' ? 26 : 12;
  };

  const getNumberOptions = () => {
    const maxNumber = getMaxNumber(paymentFrequency);
    return maxNumber
      ? Array.from({ length: maxNumber }, (_, index) => (
          <option key={index + 1} value={`${index + 1}`}>
            {index + 1}
          </option>
        ))
      : [];
  };

  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(
        ((payment.amount / getCents(instantPowerAmount)) * 100).toFixed(2)
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

  const handleProceed = () => {
    if (!checkoutToken) {
      toast.error('Checkout token is missing. Please try again.');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method.');
      return;
    }

    const numberOfPayments = parseInt(numberOfPeriods, 10);
    const instantAmount = getCents(instantPowerAmount);
    const yearlyAmount = instantAmount * numberOfPayments;

    // Transform supercharge details to use the correct key "paymentMethodId"
    const transformedSuperchargeDetails = superchargeDetails.map(detail => ({
      paymentMethodId: detail.paymentMethodId,
      amount: getCents(detail.amount),
    }));

    // Build the payload – all amounts in cents.
    const payload: CompleteCheckoutPayload = {
      checkoutToken: checkoutToken,
      instantAmount,
      yearlyAmount,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: transformedSuperchargeDetails,
      paymentFrequency: frequencyMap[paymentFrequency],
      numberOfPayments: numberOfPayments,
      offsetStartDate: planRequest.startDate,
      otherUsers: otherUserAmounts.map(user => ({
        userId: user.userId,
        amount: getCents(user.amount),
      })),
    };

    completeCheckout(payload, {
      onSuccess: (data) => {
        console.log('Checkout successful:', data);
        // Instead of navigating, post a message to the parent/opener window
        const targetWindow = window.opener || window.parent || window;
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

  // Determine overall loading state.
  const isLoadingState = plaidLoading || userLoading || isPlanLoading;
  const isErrorState =
    plaidError ||
    userError ||
    !plaidStatus?.success ||
    !plaidStatus?.data ||
    !userDetails?.success ||
    !userDetails?.data?.user.smartPay;

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
            ${ (instantPowerAmountCents / 100).toFixed(2) }
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

        {/* Payment Method Section */}
        <div className="mx-4 mb-4">
          {renderPaymentMethodSection()}
        </div>

        {/* Proceed Button */}
        <button
          className="w-full bg-black text-white font-bold py-4 rounded-lg hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={handleProceed}
          disabled={checkoutStatus === 'pending'}
        >
          {checkoutStatus === 'pending' ? (
            <div className="flex items-center justify-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            'Proceed to Confirmation'
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

      <Toaster richColors />
    </>
  );
};

export default SmartPaymentPlans;
