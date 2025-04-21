// src/routes/SmartPaymentPlans.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@remix-run/react';
import {
  CalculatePaymentPlanRequest,
  useCalculatePaymentPlan,
  SplitPayment,
} from '~/hooks/useCalculatePaymentPlan';
import { usePlaidTokensStatus } from '~/hooks/usePlaidTokens';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useCompleteCheckout, CompleteCheckoutPayload } from '~/hooks/useCompleteCheckout';
import { toast, Toaster } from 'sonner';
import { Dialog } from '@headlessui/react';
import { PaymentMethod, usePaymentMethods } from '~/hooks/usePaymentMethods';
import PaymentCircle from '~/compoments/PaymentCircle';
import PaymentMethodItem from '~/compoments/PaymentMethodItem';
import SelectedPaymentMethod from '~/compoments/SelectedPaymentMethod';

interface SplitEntry {
  userId: string;
  amount: string; // dollars as string, e.g. "25.50"
}

interface SuperchargeDetail {
  amount: string;         // dollars as string, e.g. "10.00"
  paymentMethodId: string;
}

interface SmartPaymentPlansProps {
  instantPowerAmount: string;              // dollars as string, e.g. "500.00"
  superchargeDetails?: SuperchargeDetail[];
  otherUserAmounts?: SplitEntry[];
  selectedDiscounts?: string[];
}

type PaymentFrequency = 'monthly' | 'bi-weekly';

const SmartPaymentPlans: React.FC<SmartPaymentPlansProps> = ({
  instantPowerAmount,
  superchargeDetails = [],
  otherUserAmounts = [],
  selectedDiscounts = [],
}) => {
  const navigate = useNavigate();

  // Fixed plan parameters
  const numberOfPeriods = '12';
  const paymentFrequency: PaymentFrequency = 'monthly';

  // Local state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  // Hooks
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { data: plaidStatus, isLoading: plaidLoading, isError: plaidError } = usePlaidTokensStatus();
  const { data: userDetails, isLoading: userLoading, isError: userError } = useUserDetails();

  const {
    mutate: calculatePlan,
    data: calculatedPlan,
    error: calculatePlanError,
    isPending: planLoading,
  } = useCalculatePaymentPlan();

  const { mutate: completeCheckout, status: checkoutStatus } = useCompleteCheckout();

  const checkoutToken = sessionStorage.getItem('checkoutToken') || '';

  // Parse amounts
  const instantCents = Math.round(parseFloat(instantPowerAmount) * 100);
  const superchargeCents = useMemo(
    () =>
      superchargeDetails.reduce(
        (sum, s) => sum + Math.round(parseFloat(s.amount) * 100),
        0
      ),
    [superchargeDetails]
  );
  const totalCents = instantCents + superchargeCents;

  // Map frequency
  const frequencyMap: Record<PaymentFrequency, 'BIWEEKLY' | 'MONTHLY'> = {
    'bi-weekly': 'BIWEEKLY',
    monthly: 'MONTHLY',
  };

  // Build plan request
  const planRequest: CalculatePaymentPlanRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: totalCents,
      startDate: new Date().toISOString().split('T')[0],
      superchargeDetails: superchargeDetails.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: Math.round(parseFloat(s.amount) * 100),
      })),
      otherUserAmounts: otherUserAmounts.map((u) => ({
        userId: u.userId,
        amount: Math.round(parseFloat(u.amount) * 100),
      })),
    }),
    [paymentFrequency, numberOfPeriods, totalCents, superchargeDetails, otherUserAmounts]
  );

  // Fetch plan when inputs change
  useEffect(() => {
    if (totalCents > 0) {
      calculatePlan(planRequest, {
        onError: () => toast.error('Failed to calculate payment plan.'),
      });
    }
  }, [calculatePlan, planRequest, totalCents]);

  // Default payment method
  useEffect(() => {
    if (
      paymentMethodsData?.data?.data?.length &&
      !selectedPaymentMethod
    ) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  // Prepare mock payments
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments?.map((p) => ({
      dueDate: p.dueDate,
      amount: p.amount,
      percentage: Number(
        ((p.amount / totalCents) * 100).toFixed(2)
      ),
    })) || [];

  // Handlers
  const handleMethodSelect = useCallback((m: PaymentMethod) => {
    setSelectedPaymentMethod(m);
    setIsModalOpen(false);
  }, []);

  const renderPaymentMethodSection = () => {
    if (paymentMethodsStatus === 'pending') {
      return (
        <div className="flex justify-center items-center">
          <div className="loader h-16 w-16" />
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

  const handleProceed = () => {
    if (!checkoutToken) {
      toast.error('Checkout token is missing.');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method.');
      return;
    }

    const payload: CompleteCheckoutPayload = {
      checkoutToken,
      instantAmount: instantCents,
      yearlyAmount: instantCents * parseInt(numberOfPeriods, 10),
      selectedPaymentMethod: selectedPaymentMethod.id,
      paymentFrequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      offsetStartDate: planRequest.startDate!,
      superchargeDetails: superchargeDetails.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: Math.round(parseFloat(s.amount) * 100),
      })),
      otherUsers: otherUserAmounts.map((u) => ({
        userId: u.userId,
        amount: Math.round(parseFloat(u.amount) * 100),
      })),
      discountIds: selectedDiscounts,
      selfPayActive: false,
    };

    completeCheckout(payload, {
      onSuccess: () => {
        toast.success('Payment confirmed!');
        navigate('/payment_confirmation', {
          state: { totalCents, plan: mockPayments },
        });
      },
      onError: () => toast.error('Checkout failed.'),
    });
  };

  // Loading / error flags
  const loading = plaidLoading || userLoading || planLoading;
  const error =
    plaidError ||
    userError ||
    !!calculatePlanError ||
    !plaidStatus?.success ||
    !userDetails?.data?.user.smartPay;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader h-32 w-32" />
        <p className="mt-4">Loading payment plan…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <p className="text-red-500 text-center">
          Smart Payment Plans are disabled. Please check your settings.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 bg-white min-h-screen flex flex-col">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-4">
          Smart Payment Plan — ${(totalCents / 100).toFixed(2)}
        </h1>

        {/* Summary */}
        <div className="bg-gray-50 p-4 rounded mb-6">
          <p><strong>Payments:</strong> {numberOfPeriods}</p>
          <p><strong>Frequency:</strong> {paymentFrequency}</p>
          <p><strong>Total:</strong> ${(totalCents / 100).toFixed(2)}</p>
        </div>

        {/* Installment Circles */}
        <div className="flex space-x-4 overflow-x-auto mb-6">
          {mockPayments.map((p, i) => (
            <PaymentCircle
              key={i}
              day={new Date(p.dueDate).getDate()}
              month={new Date(p.dueDate).toLocaleString('default',{month:'short'})}
              percentage={p.percentage}
              amount={(p.amount / 100).toFixed(2)}
            />
          ))}
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          {renderPaymentMethodSection()}
        </div>

        {/* Proceed */}
        <button
          onClick={handleProceed}
          disabled={checkoutStatus === 'pending'}
          className={`w-full py-3 font-bold rounded ${
            checkoutStatus === 'pending'
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
        >
          {checkoutStatus === 'pending'
            ? 'Processing…'
            : `Proceed ($${(totalCents / 100).toFixed(2)})`}
        </button>
      </div>

      {/* Payment Method Picker */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="fixed inset-0 flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black opacity-30" />
        <Dialog.Panel className="relative bg-white rounded p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold mb-4">
            Select Payment Method
          </Dialog.Title>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {paymentMethodsData?.data?.data?.map((m) => (
              <PaymentMethodItem
                key={m.id}
                method={m}
                selectedMethod={selectedPaymentMethod}
                onSelect={handleMethodSelect}
              />
            ))}
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="mt-4 w-full bg-red-500 text-white py-2 rounded"
          >
            Close
          </button>
        </Dialog.Panel>
      </Dialog>

      <Toaster richColors />
    </>
  );
};

export default SmartPaymentPlans;
