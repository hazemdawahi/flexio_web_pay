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

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

interface YearlyPaymentPlanProps {
  yearlyPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  // Instead of passing users, we now expect the split data to contain otherUserAmounts.
  // For clarity, we will parse the query parameter "otherUserAmounts".
}

const SERVER_BASE_URL = "http://192.168.1.32:8080";

const YearlyPaymentPlan: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Retrieve data from location.state (if available) or fallback to query parameters
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
  } catch (error) {
    superchargeDetails = [];
  }
  const paymentMethodId =
    stateData.paymentMethodId || searchParams.get("paymentMethodId") || "";
  // Receive otherUserAmounts from query parameters
  const otherUserAmountsStr = searchParams.get("otherUserAmounts") || "[]";
  let otherUserAmounts = [];
  try {
    otherUserAmounts = JSON.parse(otherUserAmountsStr);
  } catch (error) {
    otherUserAmounts = [];
  }

  // Log the received parameters on mount
  useEffect(() => {
    console.log("Received parameters:", {
      yearlyPowerAmount,
      superchargeDetails,
      paymentMethodId,
      otherUserAmounts,
    });
  }, [yearlyPowerAmount, superchargeDetails, paymentMethodId, otherUserAmounts]);

  // Convert the yearly amount (in cents) to dollars
  const yearlyPowerAmountValue = Number(yearlyPowerAmount) / 100 || 0;

  // State for number of months (periods) and other UI states
  const [numberOfMonths, setNumberOfMonths] = useState<string>("12");
  const paymentFrequency: "MONTHLY" = "MONTHLY";
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Additional state variables
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);

  // Starting date for the payment plan (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } =
    useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  // Retrieve checkoutToken from sessionStorage
  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // Build the plan request.
  const planRequest = useMemo(
    () => ({
      frequency: paymentFrequency,
      numberOfPayments: parseInt(numberOfMonths, 10),
      purchaseAmount: yearlyPowerAmountValue * 100, // in cents
      startDate: startDate,
    }),
    [paymentFrequency, numberOfMonths, yearlyPowerAmountValue, startDate]
  );

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    if (paymentMethodsData?.data?.data?.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethodsData.data.data[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  useEffect(() => {
    if (yearlyPowerAmountValue > 0) {
      setIsPlanLoading(true);
      calculatePlan(planRequest, {
        onSuccess: () => {
          console.log("Payment plan calculated successfully:", calculatedPlan);
          setIsPlanLoading(false);
        },
        onError: (error: Error) => {
          console.error("Error calculating payment plan:", error);
          setIsPlanLoading(false);
          toast.error("Failed to calculate the payment plan. Please try again.");
        },
      });
    }
  }, [paymentFrequency, numberOfMonths, yearlyPowerAmountValue, startDate, calculatePlan]);

  useEffect(() => {
    if (calculatePlanError) {
      console.error("Error calculating payment plan:", calculatePlanError);
      setIsPlanLoading(false);
      toast.error("Unable to calculate the payment plan. Please try again later.");
    } else if (calculatedPlan?.data) {
      console.log("Calculated Plan:", calculatedPlan.data);
      setIsPlanLoading(false);
    }
  }, [calculatedPlan, calculatePlanError]);

  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((payment: SplitPayment) => ({
      dueDate: payment.dueDate,
      amount: payment.amount,
      percentage: Number(((payment.amount / (yearlyPowerAmountValue * 100)) * 100).toFixed(2)),
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

  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc: number, field: string) => acc + parseFloat(field || "0"),
      0
    );
    const payment = parseFloat(paymentAmount || "0");
    return payment + superchargeTotal;
  };
  const totalAmount = calculateTotalAmount();

  const convertToCents = (amountStr: string): string => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return "0";
    return Math.round(amount * 100).toString();
  };

  const handleConfirm = () => {
    if (!selectedPaymentMethod || yearlyPowerAmountValue === 0) {
      toast.error("Please select a payment method and ensure the amount is greater than zero.");
      return;
    }
    if (!checkoutToken) {
      toast.error("Checkout token is missing. Please try again.");
      return;
    }
    const offsetStartDate = planRequest.startDate;
    const numberOfPayments = parseInt(numberOfMonths, 10);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Payment plan confirmed successfully!");
      // Build state to pass. We'll include otherUserAmounts (from query param) along with other data.
      const stateToPass = {
        yearlyPowerAmount,
        superchargeDetails,
        paymentFrequency,
        offsetStartDate,
        numberOfPayments,
        selectedPaymentMethod: selectedPaymentMethod.id,
        checkoutToken,
        otherUserAmounts, // Received from query parameter "otherUserAmounts"
      };
      console.log("Flex pressed. State to pass:", stateToPass);
      navigate("/payment-success", { state: stateToPass });
    }, 1500);
  };

  // Build options for months from 12 to 60.
  const getMonthOptions = () => {
    const options = [];
    for (let month = 12; month <= 60; month++) {
      options.push(
        <option key={month} value={month.toString()}>
          {month}
        </option>
      );
    }
    return options;
  };

  // Filter card-type payment methods
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
            Flex your yearly payments for ${yearlyPowerAmountValue.toFixed(2)}
          </h1>
        </div>
        {/* Number of Months Picker */}
        <div className="flex flex-col md:flex-row items-center mb-5 space-y-4 md:space-y-0 md:space-x-4">
          <div className="w-full">
            <label htmlFor="numberOfMonths" className="block text-sm font-medium text-gray-700 mb-1">
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
            yearlyPowerAmountValue === 0 || isLoading ? "bg-gray-400 cursor-not-allowed" : "hover:bg-gray-800"
          }`}
          onClick={yearlyPowerAmountValue > 0 ? handleConfirm : undefined}
          disabled={yearlyPowerAmountValue === 0 || isLoading}
        >
          {isLoading ? (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>
              {yearlyPowerAmountValue > 0
                ? `Flex $${yearlyPowerAmountValue.toFixed(2)}`
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
                  {cardMethods.map((method, index) => (
                    <PaymentMethodItem
                      key={method.id}
                      method={method}
                      selectedMethod={selectedPaymentMethod}
                      onSelect={handleMethodSelect}
                      isLastItem={index === cardMethods.length - 1}
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
