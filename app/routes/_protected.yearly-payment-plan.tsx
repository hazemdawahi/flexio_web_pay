import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import {
  useCalculatePaymentPlan,
  SplitPayment,
} from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { toast, Toaster } from "sonner";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCompleteCheckout,
  CompleteCheckoutPayload,
} from "~/hooks/useCompleteCheckout";

interface SuperchargeDetail {
  amount: string; // e.g. "500.00" or "50032"
  paymentMethodId: string;
}

export interface YearlyPaymentPlanProps {
  yearlyPowerAmount: string; // The total flex amount the user wants to flex (in dollars, as a string)
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  // Possibly "otherUserAmounts"
}

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

// Helper to correctly interpret the flex amount for display purposes.
// If the string contains a dot, it’s already a dollar value;
// if not, we assume it’s in cents so we divide by 100.
const formatDollarAmount = (amount: string): number =>
  amount.includes(".") ? parseFloat(amount) : parseInt(amount, 10) / 100;

const YearlyPaymentPlan: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Retrieve parameters.
  // The passed yearlyPowerAmount is the flex amount the user wants (in dollars as a string)
  const stateData = (location.state as Partial<YearlyPaymentPlanProps>) || {};
  const passedFlexAmountStr =
    stateData.yearlyPowerAmount ||
    searchParams.get("yearlyPowerAmount") ||
    "0";

  const superchargeDetailsStr =
    (stateData.superchargeDetails &&
      JSON.stringify(stateData.superchargeDetails)) ||
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

  // Get user details (which include yearlyPower in cents)
  const {
    data: userDetailsData,
    isLoading: userLoading,
    isError: userError,
  } = useUserDetails();
  const userYearlyPowerCents = userDetailsData?.data?.user?.yearlyPower || 0;

  // Maximum allowed flex per year is determined by the user's yearly power divided by 5.
  const maxAnnualFlexCents =
    userYearlyPowerCents > 0 ? Math.floor(userYearlyPowerCents / 5) : 0;
  const maxAnnualFlexDollars = maxAnnualFlexCents / 100;

  // Parse the passed flex amount as a dollar value for display and comparison.
  const requestedFlexDollars = formatDollarAmount(passedFlexAmountStr);
  // Convert the passed flex amount into cents for the checkout payload.
  const chosenAmountCents = getCents(passedFlexAmountStr);

  // Determine the minimum number of months required.
  // We want the monthly installment (requestedFlexDollars / (months/12))
  // to be <= maxAnnualFlexDollars => months >= (requestedFlexDollars * 12) / maxAnnualFlexDollars
  const computedMinMonths =
    maxAnnualFlexDollars > 0 && requestedFlexDollars > 0
      ? Math.ceil((requestedFlexDollars * 12) / maxAnnualFlexDollars)
      : 12;
  // Ensure a minimum of 12 months (i.e. 1 year)
  const minMonths = Math.max(12, computedMinMonths);
  const maxMonths = 60; // 5 years maximum

  // Build available duration options in one-month increments from minMonths to maxMonths.
  const monthOptions = useMemo(() => {
    const options: number[] = [];
    for (let m = minMonths; m <= maxMonths; m++) {
      options.push(m);
    }
    return options;
  }, [minMonths, maxMonths]);

  // Duration selected by the user (in months). Default to the minimum option.
  const [selectedMonths, setSelectedMonths] = useState<number>(
    monthOptions[0] || 12
  );
  useEffect(() => {
    if (!monthOptions.includes(selectedMonths)) {
      setSelectedMonths(monthOptions[0] || 12);
    }
  }, [monthOptions, selectedMonths]);

  // Other component states
  const paymentFrequency: "MONTHLY" = "MONTHLY";
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Payment methods and plan calculation hooks
  const { data: paymentMethodsData, status: paymentMethodsStatus } =
    usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } =
    useCalculatePaymentPlan();
  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // Build the plan request using the chosen flex amount (in dollars) and duration.
  const planRequest = useMemo(
    () => ({
      frequency: paymentFrequency,
      numberOfPayments: selectedMonths,
      purchaseAmount: requestedFlexDollars,
      startDate,
    }),
    [paymentFrequency, selectedMonths, requestedFlexDollars, startDate]
  );

  // Payment method selection state
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  useEffect(() => {
    const arr = paymentMethodsData?.data?.data || [];
    if (arr.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(arr[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  // Calculate the payment plan when the chosen amount or duration changes.
  useEffect(() => {
    if (requestedFlexDollars > 0) {
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
  }, [requestedFlexDollars, planRequest, calculatePlan]);

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

  // Build splitPayments for UI display.
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(
        ((payment.amount / requestedFlexDollars) * 100).toFixed(2)
      ),
    })) || [];

  // Handle payment method selection.
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setIsModalOpen(false);
  }, []);

  // Render the payment method section (or a loading/error state).
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

  // Handle checkout confirmation.
  const { mutate: completeCheckout, status: checkoutStatus } =
    useCompleteCheckout();

  const handleConfirm = () => {
    if (!selectedPaymentMethod || chosenAmountCents === 0) {
      toast.error("Please select a payment method and ensure the amount is greater than zero.");
      return;
    }
    if (!checkoutToken) {
      toast.error("Checkout token is missing. Please try again.");
      return;
    }

    const numberOfPayments = selectedMonths;
    const transformedSuperchargeDetails = superchargeDetails.map((detail) => ({
      paymentMethodId: detail.paymentMethodId,
      amount: getCents(detail.amount),
    }));

    const payload: CompleteCheckoutPayload = {
      checkoutToken: checkoutToken,
      instantAmount: 0,
      yearlyAmount: chosenAmountCents, // in cents
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

    completeCheckout(payload, {
      onSuccess: (data) => {
        console.log("YearlyPaymentPlan: Checkout successful => posting COMPLETED/PENDING", data);

        const targetWindow = window.opener || window.parent || window;

        // If there are otherUserAmounts, post "PENDING" (no error). Otherwise "COMPLETED".
        if (otherUserAmounts.length > 0) {
          targetWindow.postMessage(
            {
              status: "PENDING",
              checkoutToken,
              data,
            },
            "*"
          );
          toast.success("Payment plan confirmed for other user amounts. Payment is pending!");
        } else {
          targetWindow.postMessage(
            {
              status: "COMPLETED",
              checkoutToken,
              data,
            },
            "*"
          );
          toast.success("Payment plan confirmed successfully!");
        }
      },
      onError: (error: Error) => {
        console.error("Error during checkout:", error);
        toast.error("Failed to complete checkout. Please try again.");
      },
    });
  };

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex flex-col mb-5">
          <h1 className="text-2xl font-bold text-black">
            Flex your payments for ${requestedFlexDollars.toFixed(2)}
          </h1>
          {maxAnnualFlexCents > 0 && (
            <p className="text-sm text-gray-600">
              Maximum allowed per year: ${maxAnnualFlexDollars.toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment Duration Selection */}
        <div className="mb-5">
          <label
            htmlFor="duration"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Payment Duration (Months)
          </label>
          <select
            id="duration"
            value={selectedMonths}
            onChange={(e) => setSelectedMonths(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "month" : "months"}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Plan Section */}
        {requestedFlexDollars > 0 && (
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
            chosenAmountCents === 0 || checkoutStatus === "pending"
              ? "bg-gray-400 cursor-not-allowed"
              : "hover:bg-gray-800"
          }`}
          onClick={chosenAmountCents > 0 ? handleConfirm : undefined}
          disabled={chosenAmountCents === 0 || checkoutStatus === "pending"}
        >
          {checkoutStatus === "pending" ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {chosenAmountCents > 0
                ? `Flex $${(chosenAmountCents / 100).toFixed(2)} over ${selectedMonths} ${
                    selectedMonths === 1 ? "month" : "months"
                  }`
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
