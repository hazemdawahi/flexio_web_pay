import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useCalculatePaymentPlan, SplitPayment } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { toast, Toaster } from "sonner";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import { motion, AnimatePresence } from "framer-motion";
import { useCompleteCheckout, CompleteCheckoutPayload } from "~/hooks/useCompleteCheckout";

interface SuperchargeDetail {
  amount: string; // e.g. "500.00" or in cents "50000"
  paymentMethodId: string;
}

export interface YearlyPaymentPlanProps {
  yearlyPowerAmount: string;
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  // Possibly "otherUserAmounts"
}

// Convert "50.00" -> 5000
const convertDollarStringToCents = (amount: string): number => {
  const [dollars, cents = ""] = amount.split(".");
  const paddedCents = cents.padEnd(2, "0").slice(0, 2);
  return parseInt(dollars + paddedCents, 10);
};

// If string has '.', convert to cents; else assume already cents
const getCents = (amount: string): number =>
  amount.includes(".") ? convertDollarStringToCents(amount) : Number(amount);

const YearlyPaymentPlan: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // 1) Retrieve from state or query
  const stateData = (location.state as Partial<YearlyPaymentPlanProps>) || {};
  const yearlyPowerAmount =
    stateData.yearlyPowerAmount || searchParams.get("yearlyPowerAmount") || "0";

  const superchargeDetailsStr =
    (stateData.superchargeDetails && JSON.stringify(stateData.superchargeDetails)) ||
    searchParams.get("superchargeDetails") ||
    "[]";

  let superchargeDetails: SuperchargeDetail[] = [];
  try {
    superchargeDetails = JSON.parse(superchargeDetailsStr);
  } catch {
    superchargeDetails = [];
  }

  const paymentMethodId =
    stateData.paymentMethodId || searchParams.get("paymentMethodId") || "";

  const otherUserAmountsStr = searchParams.get("otherUserAmounts") || "[]";
  let otherUserAmounts: any[] = [];
  try {
    otherUserAmounts = JSON.parse(otherUserAmountsStr);
  } catch {
    otherUserAmounts = [];
  }

  // Debug
  useEffect(() => {
    console.log("YearlyPaymentPlan - received params:", {
      yearlyPowerAmount,
      superchargeDetails,
      paymentMethodId,
      otherUserAmounts,
    });
  }, [yearlyPowerAmount, superchargeDetails, paymentMethodId, otherUserAmounts]);

  // 2) Convert to cents
  const yearlyAmountCents = getCents(yearlyPowerAmount);
  const yearlyPowerAmountValue = yearlyAmountCents / 100 || 0;

  // States
  const [numberOfMonths, setNumberOfMonths] = useState<string>("12");
  const paymentFrequency: "MONTHLY" = "MONTHLY";
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Additional placeholders
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);

  // Plan start date
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Hooks
  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } =
    useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // Build plan request
  const planRequest = useMemo(
    () => ({
      frequency: paymentFrequency,
      numberOfPayments: parseInt(numberOfMonths, 10),
      purchaseAmount: yearlyAmountCents,
      startDate,
    }),
    [paymentFrequency, numberOfMonths, yearlyAmountCents, startDate]
  );

  // PaymentMethod
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    const arr = paymentMethodsData?.data?.data || [];
    if (arr.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(arr[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  // 3) Calculate plan if > 0
  useEffect(() => {
    if (yearlyPowerAmountValue > 0) {
      setIsPlanLoading(true);
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log("Payment plan calculated:", calculatedPlan);
          setIsPlanLoading(false);
        },
        onError: (error: Error) => {
          console.error("Error calculating payment plan:", error);
          setIsPlanLoading(false);
          toast.error("Failed to calculate the payment plan. Please try again.");
        },
      });
    }
  }, [yearlyPowerAmountValue, planRequest, calculatePlan]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error("Error calculating payment plan:", calculatePlanError);
      setIsPlanLoading(false);
      toast.error("Unable to calculate the payment plan. Please try again later.");
    } else if (calculatedPlan?.data) {
      console.log("Calculated Plan data:", calculatedPlan.data);
      setIsPlanLoading(false);
    }
  }, [calculatedPlan, calculatePlanError]);

  // 4) Build splitPayments for UI
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(
        ((payment.amount / yearlyAmountCents) * 100).toFixed(2)
      ),
    })) || [];

  // Payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setIsModalOpen(false);
  }, []);

  // Show payment methods
  const renderPaymentMethodSection = () => {
    if (paymentMethodsStatus === "pending") {
      return (
        <div className="flex justify-center items-center">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
        </div>
      );
    }
    if (paymentMethodsStatus === "error") {
      return <p className="text-red-500">Error fetching payment methods</p>;
    }
    return (
      <SelectedPaymentMethod
        selectedMethod={selectedPaymentMethod}
        onPress={() => setIsModalOpen(true)}
      />
    );
  };

  // 5) useCompleteCheckout
  const { mutate: completeCheckout, status: checkoutStatus, error: checkoutError } =
    useCompleteCheckout();

  // 6) handleConfirm => final
  const handleConfirm = () => {
    if (!selectedPaymentMethod || yearlyPowerAmountValue === 0) {
      toast.error(
        "Please select a payment method and ensure the amount is greater than zero."
      );
      return;
    }
    if (!checkoutToken) {
      toast.error("Checkout token is missing. Please try again.");
      return;
    }

    const numberOfPayments = parseInt(numberOfMonths, 10);
    const yearlyAmount = yearlyAmountCents;

    const transformedSuperchargeDetails = superchargeDetails.map((detail) => ({
      paymentMethodId: detail.paymentMethodId,
      amount: getCents(detail.amount),
    }));

    const payload: CompleteCheckoutPayload = {
      checkoutToken: checkoutToken,
      instantAmount: 0,
      yearlyAmount: yearlyAmount,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: transformedSuperchargeDetails,
      paymentFrequency,
      numberOfPayments,
      offsetStartDate: planRequest.startDate,
      otherUsers: otherUserAmounts.map((user: any) => ({
        userId: user.userId,
        amount: getCents(user.amount),
      })),
    };

    console.log("Checkout payload", payload);

    // Fire checkout
    completeCheckout(payload, {
      onSuccess: (data) => {
        console.log("YearlyPaymentPlan: Checkout successful => posting COMPLETED", data);

        // Post COMPLETED message right away (no delay).
        // The parent script (custom-button.js) will close the popup/sheet,
        // then setTimeout(() => alert(...)) so user is not blocked.
        const targetWindow = window.opener || window.parent || window;
        targetWindow.postMessage(
          {
            status: "COMPLETED",
            checkoutToken,
            data,
          },
          "*"
        );

        // We still show a toast here. You can remove or keep it.
        toast.success("Payment plan confirmed successfully!");
      },
      onError: (error: Error) => {
        console.error("Error during checkout:", error);
        toast.error("Failed to complete checkout. Please try again.");
      },
    });
  };

  // 7) Month options
  const getMonthOptions = () => {
    const opts = [];
    for (let i = 12; i <= 60; i++) {
      opts.push(
        <option key={i} value={i.toString()}>
          {i}
        </option>
      );
    }
    return opts;
  };

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center mb-5">
          <h1 className="text-2xl font-bold text-black">
            Flex your yearly payments for $
            {(yearlyAmountCents / 100).toFixed(2)}
          </h1>
        </div>

        {/* Number of Months */}
        <div className="flex flex-col md:flex-row items-center mb-5 space-y-4 md:space-y-0 md:space-x-4">
          <div className="w-full">
            <label
              htmlFor="numberOfMonths"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Number of Months
            </label>
            <select
              id="numberOfMonths"
              value={numberOfMonths}
              onChange={(e) => setNumberOfMonths(e.target.value)}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {getMonthOptions()}
            </select>
          </div>
        </div>

        {/* Payment Plan Section */}
        {yearlyPowerAmountValue > 0 && (
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
            yearlyPowerAmountValue === 0 || checkoutStatus === "pending"
              ? "bg-gray-400 cursor-not-allowed"
              : "hover:bg-gray-800"
          }`}
          onClick={yearlyPowerAmountValue > 0 ? handleConfirm : undefined}
          disabled={yearlyPowerAmountValue === 0 || checkoutStatus === "pending"}
        >
          {checkoutStatus === "pending" ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {yearlyPowerAmountValue > 0
                ? `Flex $${(yearlyAmountCents / 100).toFixed(2)}`
                : "Flex your payments"}
            </span>
          )}
        </button>
      </div>

      {/* Payment Methods Modal */}
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
                <h2 className="text-xl font-semibold mb-4 px-4">
                  Select Payment Method
                </h2>
                <div className="space-y-4 px-4 pb-4">
                  {paymentMethodsData?.data?.data
                    ?.filter((method: PaymentMethod) => method.type === "card")
                    .map((method, index) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={handleMethodSelect}
                        isLastItem={
                          index === paymentMethodsData.data.data.length - 1
                        }
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

export default YearlyPaymentPlan;
