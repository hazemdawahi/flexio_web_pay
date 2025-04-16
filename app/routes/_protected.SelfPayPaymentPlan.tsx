import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useCalculatePaymentPlan, SplitPayment } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { toast, Toaster } from "sonner";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import { motion, AnimatePresence } from "framer-motion";
import { useCompleteCheckout, CompleteCheckoutPayload } from "~/hooks/useCompleteCheckout";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";

const SERVER_BASE_URL = "http://192.168.1.32:8080";

/*
  NOTE:
  – The checkout details provide the total amount as-is (e.g., a string "500.00").
  – All amounts are used exactly as provided by the API.
*/

interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string; // dollars as string (e.g., "500.00")
  paymentMethodId: string;
}

interface SelfPayPaymentPlanProps {
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  otherUserAmounts?: SplitEntry[];
  selectedDiscounts: string[];
}

type PaymentFrequency = "BIWEEKLY" | "MONTHLY";

const SelfPayPaymentPlan: React.FC<SelfPayPaymentPlanProps> = ({
  superchargeDetails,
  paymentMethodId,
  otherUserAmounts = [],
  selectedDiscounts,
}) => {
  const navigate = useNavigate();

  // Retrieve the checkout token from sessionStorage.
  const checkoutToken =
    typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";

  // Call the checkout details hook.
  const { data: checkoutData, isLoading: checkoutLoading, error: checkoutError } =
    useCheckoutDetail(checkoutToken);

  // Local state declarations.
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>("1");
  // Initially start with BIWEEKLY.
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("BIWEEKLY");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } = useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();
  const { mutate: completeCheckout, status: checkoutStatus, error: completeCheckoutError } = useCompleteCheckout();

  // Use the checkout total as provided by the API.
  const checkoutTotal =
    checkoutData && checkoutData.checkout
      ? checkoutData.checkout.totalAmount.amount
      : "0.00";
  const displayedCheckoutTotal = parseFloat(checkoutTotal) || 0;
  const purchaseAmountCents = displayedCheckoutTotal; // Used as provided

  // Mapping from PaymentFrequency to API expected value.
  const frequencyMap: Record<PaymentFrequency, "BIWEEKLY" | "MONTHLY"> = {
    BIWEEKLY: "BIWEEKLY",
    MONTHLY: "MONTHLY",
  };

  // Build the plan request.
  const planRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: displayedCheckoutTotal,
      startDate: startDate,
    }),
    [paymentFrequency, numberOfPeriods, displayedCheckoutTotal, startDate]
  );

  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData]);

  useEffect(() => {
    if (displayedCheckoutTotal > 0) {
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log("Payment plan calculated successfully.");
        },
        onError: (error: Error) => {
          console.error("Error calculating payment plan:", error);
          toast.error("Failed to calculate the payment plan. Please try again.");
        },
      });
    }
  }, [paymentFrequency, numberOfPeriods, displayedCheckoutTotal, startDate, calculatePlan, planRequest]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error("Error calculating payment plan:", calculatePlanError);
      toast.error("Unable to calculate the payment plan. Please try again later.");
    } else if (calculatedPlan?.data) {
      console.log("Calculated Plan:", calculatedPlan.data);
    }
  }, [calculatedPlan, calculatePlanError]);

  // Map calculated split payments to displayable items.
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments?.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(((payment.amount / displayedCheckoutTotal) * 100).toFixed(2)),
    })) || [];

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setIsModalOpen(false);
  }, []);

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

  // --- Determine Available Payment Frequencies ---
  // Check if any qualifying tier (by amount) allows a valid monthly option.
  let availablePaymentFrequencies: PaymentFrequency[] = ["BIWEEKLY", "MONTHLY"];
  if (checkoutData && checkoutData.configuration && checkoutData.configuration.selfPayTiers) {
    const tiers = checkoutData.configuration.selfPayTiers;
    const checkoutAmount = parseFloat(checkoutData.checkout.totalAmount.amount);
    let possibleMonthly = false;
    for (const tier of tiers) {
      const tierMinAmount = parseFloat(tier.minAmount);
      const tierMaxAmount = parseFloat(tier.maxAmount);
      const qualifiesAmount =
        tierMinAmount === 0 && tierMaxAmount === 0
          ? true
          : checkoutAmount >= tierMinAmount && checkoutAmount <= tierMaxAmount;
      if (qualifiesAmount) {
        // For monthly, convert tier term limits (already in weeks) to period counts using 4 weeks per period.
        const allowedMinMonthly = Math.ceil(tier.minTerm / 4);
        const allowedMaxMonthly = Math.floor(tier.maxTerm / 4);
        if (allowedMaxMonthly >= allowedMinMonthly && allowedMinMonthly > 0) {
          possibleMonthly = true;
          break;
        }
      }
    }
    if (!possibleMonthly) {
      availablePaymentFrequencies = ["BIWEEKLY"];
    }
  }

  // If the current frequency is not available, reset it to BIWEEKLY.
  useEffect(() => {
    if (!availablePaymentFrequencies.includes(paymentFrequency)) {
      setPaymentFrequency("BIWEEKLY");
    }
  }, [availablePaymentFrequencies, paymentFrequency]);

  // --- Generate Allowed Period Options Based on Self-Pay Tier ---
  const getNumberOptions = () => {
    if (
      checkoutData &&
      checkoutData.configuration &&
      checkoutData.configuration.selfPayTiers &&
      checkoutData.configuration.selfPayTiers.length > 0
    ) {
      const checkoutAmount = parseFloat(checkoutData.checkout.totalAmount.amount);
      // Find the first qualifying tier (by amount).
      const qualifyingTier = checkoutData.configuration.selfPayTiers.find((tier) => {
        const tierMinAmount = parseFloat(tier.minAmount);
        const tierMaxAmount = parseFloat(tier.maxAmount);
        return (tierMinAmount === 0 && tierMaxAmount === 0) ||
          (checkoutAmount >= tierMinAmount && checkoutAmount <= tierMaxAmount);
      });
      if (qualifyingTier) {
        if (paymentFrequency === "BIWEEKLY") {
          // The tier terms are already in biweekly units.
          const allowedMin = qualifyingTier.minTerm;
          const allowedMax = qualifyingTier.maxTerm;
          if (allowedMax < allowedMin) return [];
          return Array.from({ length: allowedMax - allowedMin + 1 }, (_, index) => {
            const value = allowedMin + index;
            return (
              <option key={value} value={value}>
                {value}
              </option>
            );
          });
        } else if (paymentFrequency === "MONTHLY") {
          // Convert the week-based tier terms into monthly periods using 4 weeks per period.
          const allowedMin = Math.ceil(qualifyingTier.minTerm / 4);
          const allowedMax = Math.floor(qualifyingTier.maxTerm / 4);
          if (allowedMax < allowedMin) return [];
          return Array.from({ length: allowedMax - allowedMin + 1 }, (_, index) => {
            const value = allowedMin + index;
            return (
              <option key={value} value={value}>
                {value}
              </option>
            );
          });
        }
      }
    }
    // Fallback if no qualifying tier is found.
    const defaultMax = paymentFrequency === "BIWEEKLY" ? 52 : 24;
    return Array.from({ length: defaultMax }, (_, index) => (
      <option key={index + 1} value={`${index + 1}`}>
        {index + 1}
      </option>
    ));
  };

  // --- Self-Pay Tier Validation ---
  // For validation, BIWEEKLY periods count as 1 unit, and MONTHLY periods count as 4 weeks.
  let isSelfPayTierValid = false;
  if (
    !checkoutLoading &&
    checkoutData &&
    checkoutData.configuration &&
    checkoutData.configuration.selfPayTiers &&
    checkoutData.checkout &&
    checkoutData.checkout.totalAmount
  ) {
    const checkoutAmount = parseFloat(checkoutData.checkout.totalAmount.amount);
    const periods = parseInt(numberOfPeriods, 10);
    let effectiveTerm = 0;
    if (paymentFrequency === "BIWEEKLY") {
      effectiveTerm = periods; // Already in biweekly units.
    } else if (paymentFrequency === "MONTHLY") {
      effectiveTerm = periods * 4; // Each monthly period equals 4 weeks.
    }
    isSelfPayTierValid = checkoutData.configuration.selfPayTiers.some((tier) => {
      const tierMinAmount = parseFloat(tier.minAmount);
      const tierMaxAmount = parseFloat(tier.maxAmount);
      const qualifiesAmount =
        tierMinAmount === 0 && tierMaxAmount === 0
          ? true
          : checkoutAmount >= tierMinAmount && checkoutAmount <= tierMaxAmount;
      const qualifiesTerm = effectiveTerm >= tier.minTerm && effectiveTerm <= tier.maxTerm;
      return qualifiesAmount && qualifiesTerm;
    });
  }

  const handleConfirm = () => {
    if (!selectedPaymentMethod || purchaseAmountCents === 0) {
      toast.error("Please select a payment method and ensure the amount is greater than zero.");
      return;
    }
    if (!checkoutToken) {
      toast.error("Checkout token is missing. Please try again.");
      return;
    }
    if (!isSelfPayTierValid) {
      toast.error("The selected number of periods does not meet the self pay tier requirements.");
      return;
    }

    const numberOfPayments = parseInt(numberOfPeriods, 10);
    const instantAmount = 0;
    const yearlyAmount = 0; // For self-pay, yearlyAmount is 0.

    const transformedSuperchargeDetails = (superchargeDetails || []).map((detail) => ({
      paymentMethodId: detail.paymentMethodId,
      amount: parseFloat(detail.amount),
    }));

    const payload: CompleteCheckoutPayload = {
      checkoutToken: checkoutToken,
      instantAmount,
      yearlyAmount,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: transformedSuperchargeDetails,
      paymentFrequency: paymentFrequency,
      numberOfPayments: numberOfPayments,
      offsetStartDate: startDate,
      otherUsers: otherUserAmounts?.map((user) => ({
        userId: user.userId,
        amount: Math.round(parseFloat(user.amount) * 100),
      })) || [],
      discountIds: selectedDiscounts,
      selfPayActive: true,
    };

    console.log("CompleteCheckoutPayload", payload);

    completeCheckout(payload, {
      onSuccess: (data) => {
        console.log("SelfPayPaymentPlan: Checkout successful:", data);
        const targetWindow = window.opener || window.parent || window;
        if (otherUserAmounts?.length > 0) {
          targetWindow.postMessage({ status: "PENDING", checkoutToken, data }, "*");
          toast.success("Payment plan confirmed for other user amounts. Payment is pending!");
        } else {
          targetWindow.postMessage({ status: "COMPLETED", checkoutToken, data }, "*");
          toast.success("Payment plan confirmed successfully!");
        }
      },
      onError: (error: Error) => {
        console.error("Error during checkout:", error);
        toast.error("Failed to complete checkout. Please try again.");
      },
    });
  };

  const getMaxNumber = (frequency: PaymentFrequency): number => {
    return frequency === "BIWEEKLY" ? 52 : 24;
  };

  return (
    <>
      {checkoutLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
          <h1 className="text-2xl font-bold">Loading Checkout Details...</h1>
          <div className="mt-4 text-4xl animate-spin">🔄</div>
        </div>
      ) : checkoutError || !checkoutData || !checkoutData.checkout ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
          <h1 className="text-2xl font-bold">Error Loading Checkout Details</h1>
          <p className="mt-4 text-lg text-red-600">
            {checkoutError?.message || "No checkout details found."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col p-4 bg-white min-h-screen">
          {/* Header */}
          <div className="flex items-center mb-5">
            <h1 className="text-2xl font-bold text-black">
              Self Pay Payment Plan for ${displayedCheckoutTotal.toFixed(2)}
            </h1>
          </div>

          {/* Periods & Payment Frequency Pickers (stacked vertically) */}
          <div className="flex flex-col space-y-4 mb-5">
            <div className="w-full">
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
            <div className="w-full">
              <label htmlFor="paymentFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Frequency
              </label>
              <select
                id="paymentFrequency"
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {availablePaymentFrequencies.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq === "BIWEEKLY" ? "Bi-weekly" : "Monthly"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Plan Section */}
          {displayedCheckoutTotal > 0 && (
            <div className="mb-5">
              <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
              {calculatedPlan?.data ? (
                <PaymentPlanMocking
                  payments={mockPayments}
                  showChangeDateButton={true}
                  isCollapsed={false}
                  initialDate={new Date(startDate)}
                  onDateSelected={(date: Date) => setStartDate(date.toISOString().split("T")[0])}
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
            className={`w-full bg-black text-white font-bold py-3 rounded-lg ${
              purchaseAmountCents === 0 || checkoutStatus === "pending" || !isSelfPayTierValid
                ? "bg-gray-400 cursor-not-allowed"
                : "hover:bg-gray-800"
            }`}
            onClick={handleConfirm}
            disabled={purchaseAmountCents === 0 || checkoutStatus === "pending" || !isSelfPayTierValid}
          >
            {checkoutStatus === "pending" ? (
              <div className="flex justify-center items-center">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <span>
                {displayedCheckoutTotal > 0
                  ? `Self Pay $${displayedCheckoutTotal.toFixed(2)}`
                  : "Self Pay Payment Plan"}
              </span>
            )}
          </button>
        </div>
      )}

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

export default SelfPayPaymentPlan;
