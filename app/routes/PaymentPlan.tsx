// app/routes/payment-plan.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@remix-run/react'; // Ensure correct import based on your routing library
import {
  usePaymentMethods,
  PaymentMethod,
} from '~/hooks/usePaymentMethods';
import {
  useCalculatePaymentPlan,
  SplitPayment,
} from '~/hooks/useCalculatePaymentPlan';
import { useUserDetails } from '~/hooks/useUserDetails';
import { Dialog } from '@headlessui/react';
import { toast, Toaster } from 'sonner';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod';
import PaymentPlanMocking from '~/compoments/PaymentPlanMocking';
import PaymentMethodItem from '~/compoments/PaymentMethodItem';

const SERVER_BASE_URL = 'http://192.168.1.32:8080';

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

interface PaymentPlanProps {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
}

type PaymentFrequency = 'MONTHLY'; // Fixed to 'MONTHLY'

const PaymentPlan: React.FC<PaymentPlanProps> = ({
  instantPowerAmount,
  superchargeDetails,
  paymentMethodId,
}) => {
  const navigate = useNavigate();

  const instantPowerAmountValue = Number(instantPowerAmount) / 100 || 0; // Convert cents to dollars

  // Fixed number of periods to 12 and payment frequency to 'MONTHLY'
  const numberOfPeriods = '12';
  const paymentFrequency: PaymentFrequency = 'MONTHLY'; // Fixed to 'MONTHLY'

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: userDetailsData } = useUserDetails();

  // Mapping from PaymentFrequency to API expected format
  const frequencyMap: Record<PaymentFrequency, 'MONTHLY'> = {
    'MONTHLY': 'MONTHLY',
  };

  // Memoize planRequest to prevent it from being recreated on every render
  const planRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: instantPowerAmountValue * 100, // Convert dollars back to cents
      startDate: new Date().toISOString().split('T')[0],
    }),
    [paymentFrequency, numberOfPeriods, instantPowerAmountValue]
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
    if (!selectedPaymentMethod || instantPowerAmountValue === 0) return;

    setIsLoading(true);

    // Prepare request for updating an existing card
    const updateRequest = {
      totalAmount: instantPowerAmountValue * 100, // Focus on instant power amount
      instantaneousPowerAmount: instantPowerAmountValue * 100,
      instantaneousAmount: instantPowerAmountValue * 100,
      spendingLimit: instantPowerAmountValue * 100,
      paymentFrequency: parseInt(numberOfPeriods, 10), // Fixed to 12
      planType: 'MONTHLY' as const, // Fixed to 'MONTHLY'
      paymentMethodId: selectedPaymentMethod.id,
      offsetStartDate: new Date().toISOString().split('T')[0],
      superchargeDetails, // Pass superchargeDetails if needed
    };

    // Placeholder for handleConfirm logic
    // Implement your desired confirmation behavior here.

    // Example Placeholder Action:
    // submitPaymentPlan(updateRequest)
    //   .then(() => {
    //     setIsLoading(false);
    //     navigate('/payment-success');
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
      navigate('/payment-success');
    }, 1500);
  };

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

export default PaymentPlan;
