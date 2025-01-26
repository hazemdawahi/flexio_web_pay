// app/routes/payment-plan.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  usePaymentMethods,
  PaymentMethod,
} from '~/hooks/usePaymentMethods';
import {
  useCalculatePaymentPlan,
  SplitPayment,
} from '~/hooks/useCalculatePaymentPlan';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useMerchantDetail } from '~/hooks/useMerchantDetail';
import { Dialog } from '@headlessui/react';
import { FaChevronDown } from 'react-icons/fa';
import { toast, Toaster } from 'sonner';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod';
import PaymentPlanMocking from '~/compoments/PaymentPlanMocking';
import PaymentMethodItem from '~/compoments/PaymentMethodItem';

const SERVER_BASE_URL = 'http://192.168.1.32:8080';

interface PaymentPlanProps {
  merchantId?: string;
  amount?: string;
  instantPowerAmount?: string;
  superchargeDetails?: string;
}

const PaymentPlan: React.FC<PaymentPlanProps> = (props) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Use props if available, fallback to local search params
  const merchantId = props.merchantId || searchParams.get('merchantId') || '';
  const amountParam = props.amount || searchParams.get('amount') || '0';
  const instantPowerAmountParam = props.instantPowerAmount || searchParams.get('instantPowerAmount') || '0';
  const superchargeDetailsParam = props.superchargeDetails || searchParams.get('superchargeDetails') || '';

  const initialAmount = Number(amountParam) / 100 || 0;
  const instantPowerAmount = Number(instantPowerAmountParam) / 100 || 0; // Convert cents to dollars

  let superchargeList: any[] = [];
  if (superchargeDetailsParam) {
    try {
      superchargeList = JSON.parse(superchargeDetailsParam as string);
      console.log("Supercharge Details in PaymentPlan:", superchargeList);
      console.log("InstantPower Details in PaymentPlan:", instantPowerAmountParam);
    } catch (e) {
      console.error("Error parsing superchargeDetails in PaymentPlan:", e);
    }
  }

  const { data: merchantData } = useMerchantDetail(merchantId);
  const { data: userDetailsData } = useUserDetails();
  
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>('1');
  const [paymentFrequency, setPaymentFrequency] = useState<'bi-weekly' | 'monthly'>('bi-weekly');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const GREEN_COLOR = "#4cd964";

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();

  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData]);

  useEffect(() => {
    if (instantPowerAmount > 0) {
      setIsPlanLoading(true);
      const amountInCents = instantPowerAmount * 100;
      calculatePlan({
        frequency: paymentFrequency === 'bi-weekly' ? 'BIWEEKLY' : 'MONTHLY',
        numberOfPayments: parseInt(numberOfPeriods),
        purchaseAmount: amountInCents,
        startDate: new Date().toISOString().split("T")[0],
      });
    }
  }, [paymentFrequency, numberOfPeriods, instantPowerAmount, calculatePlan]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error("Error calculating payment plan:", calculatePlanError);
      setIsPlanLoading(false);
      toast.error('Unable to calculate the payment plan. Please try again later.');
    } else if (calculatedPlan?.data) {
      console.log("Calculated Plan:", calculatedPlan.data);
      setIsPlanLoading(false);
    }
  }, [calculatedPlan, calculatePlanError]);

  const getMaxNumber = (frequency: string): number | undefined => {
    return frequency === 'bi-weekly' ? 26 : 12;
  };
  
  console.log("calculatedPlan", JSON.stringify(calculatedPlan));
  
  const handleConfirm = () => {
    if (!selectedPaymentMethod || (instantPowerAmount === 0 && initialAmount === 0)) return;

    setIsLoading(true);

    // Prepare request for updating an existing card
    const updateRequest = {
      totalAmount: initialAmount * 100,
      instantaneousPowerAmount: instantPowerAmount * 100,
      instantaneousAmount: instantPowerAmount * 100,
      spendingLimit: initialAmount * 100,
      paymentFrequency: parseInt(numberOfPeriods),
      planType: paymentFrequency === 'bi-weekly' ? ('BIWEEKLY' as const) : ('MONTHLY' as const),
      paymentMethodId: selectedPaymentMethod.id,
      offsetStartDate: new Date().toISOString().split("T")[0],
    };

    // Placeholder for handleConfirm logic
    // Since useUpdateCardAndSettings and useIssueVirtualCard have been removed,
    // implement the desired confirmation behavior here.
    // For example, you might want to submit the payment plan to another API endpoint.

    // Example Placeholder Action:
    // submitPaymentPlan(updateRequest)
    //   .then(() => {
    //     setIsLoading(false);
    //     navigate('/card-details');
    //   })
    //   .catch((error) => {
    //     setIsLoading(false);
    //     console.error("Error confirming payment plan:", error);
    //     toast.error('Failed to confirm the payment plan. Please try again.');
    //   });

    // For now, we'll simulate a successful confirmation.
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Payment plan confirmed successfully!');
      navigate('/card-details');
    }, 1500);
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

  const mockPayments = calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
    dueDate: payment.dueDate,
    amount: payment.amount,
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

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center mb-5">
          <img
            src={`${SERVER_BASE_URL}${merchantData?.data?.brand.displayLogo}`}
            alt="Merchant Logo"
            className="w-16 h-16 border border-gray-300 rounded-full mr-4"
          />
          <div>
            <h1 className="text-2xl font-bold text-black">
              Flex your payments for ${initialAmount.toFixed(2)}
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
              onChange={(e) => setPaymentFrequency(e.target.value as 'bi-weekly' | 'monthly')}
              disabled={numberOfPeriods === '1'}
              className={`block w-full p-2 border ${
                numberOfPeriods === '1' ? 'bg-gray-100' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Payment Plan */}
        {instantPowerAmount > 0 && (
          <div className="mb-5">
            <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
            <PaymentPlanMocking
              payments={mockPayments}
              showChangeDateButton={true}
              isCollapsed={false}
            />
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
            (instantPowerAmount === 0 && initialAmount === 0) || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'hover:bg-gray-800'
          }`}
          onClick={(instantPowerAmount > 0 || initialAmount > 0) ? handleConfirm : undefined}
          disabled={(instantPowerAmount === 0 && initialAmount === 0) || isLoading}
        >
          {isLoading ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {instantPowerAmount > 0
                ? `Flex $${instantPowerAmount.toFixed(2)}`
                : `Pay $${initialAmount.toFixed(2)}`}
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
              {paymentMethodsData?.data?.data?.map((method: PaymentMethod, index: number) => (
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

export default PaymentPlan;
