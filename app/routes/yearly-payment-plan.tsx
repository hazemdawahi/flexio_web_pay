import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useCalculatePaymentPlan, SplitPayment } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { Dialog } from "@headlessui/react";
import { toast, Toaster } from "sonner";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

interface YearlyPaymentPlanProps {
  yearlyPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
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

  // Convert the yearly amount (in cents) to dollars
  const yearlyPowerAmountValue = Number(yearlyPowerAmount) / 100 || 0;

  // State for user-selected number of periods and payment frequency
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>("1");
  const [paymentFrequency, setPaymentFrequency] = useState<"BIWEEKLY" | "MONTHLY">("MONTHLY");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Added state variables (if needed later)
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);

  const { data: paymentMethodsData, status: paymentMethodsStatus } = usePaymentMethods();
  const { mutate: calculatePlan, data: calculatedPlan, error: calculatePlanError } =
    useCalculatePaymentPlan();
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  // Retrieve checkoutToken from sessionStorage
  const checkoutToken = sessionStorage.getItem("checkoutToken");

  const frequencyMap: Record<"BIWEEKLY" | "MONTHLY", "BIWEEKLY" | "MONTHLY"> = {
    BIWEEKLY: "BIWEEKLY",
    MONTHLY: "MONTHLY",
  };

  const planRequest = useMemo(
    () => ({
      frequency: frequencyMap[paymentFrequency],
      numberOfPayments: parseInt(numberOfPeriods, 10),
      // purchaseAmount in cents (yearlyPowerAmountValue was converted from cents to dollars above)
      purchaseAmount: yearlyPowerAmountValue * 100,
      startDate: new Date().toISOString().split("T")[0],
    }),
    [paymentFrequency, numberOfPeriods, yearlyPowerAmountValue]
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
  }, [paymentFrequency, numberOfPeriods, yearlyPowerAmountValue, calculatePlan]);

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
    const numberOfPayments = parseInt(numberOfPeriods, 10);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Payment plan confirmed successfully!");
      navigate("/payment-success", {
        state: {
          yearlyPowerAmount,
          paymentPlan: calculatedPlan?.data?.splitPayments || [],
          superchargeDetails,
          paymentFrequency,
          offsetStartDate,
          numberOfPayments,
          selectedPaymentMethod,
          checkoutToken,
        },
      });
      console.log("State:", {
        yearlyPowerAmount,
        paymentPlan: calculatedPlan?.data?.splitPayments || [],
        superchargeDetails,
        paymentFrequency,
        offsetStartDate,
        numberOfPayments,
        selectedPaymentMethod,
        checkoutToken,
      });
    }, 1500);
  };

  const getMaxNumber = (frequency: "BIWEEKLY" | "MONTHLY"): number =>
    frequency === "BIWEEKLY" ? 26 : 12;
  const getNumberOptions = () => {
    const maxNumber = getMaxNumber(paymentFrequency);
    return Array.from({ length: maxNumber }, (_, index) => (
      <option key={index + 1} value={`${index + 1}`}>
        {index + 1}
      </option>
    ));
  };

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center mb-5">
          <h1 className="text-2xl font-bold text-black">
            Flex your yearly payments for ${yearlyPowerAmountValue.toFixed(2)}
          </h1>
        </div>
        {/* Pickers */}
        <div className="flex flex-col md:flex-row items-center mb-5 space-y-4 md:space-y-0 md:space-x-4">
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
          <div className="w-full md:w-1/2">
            <label htmlFor="paymentFrequency" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Frequency
            </label>
            <select
              id="paymentFrequency"
              value={paymentFrequency}
              onChange={(e) => setPaymentFrequency(e.target.value as "BIWEEKLY" | "MONTHLY")}
              disabled={numberOfPeriods === "1"}
              className={`block w-full p-2 border ${
                numberOfPeriods === "1" ? "bg-gray-100" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
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

export default YearlyPaymentPlan;
