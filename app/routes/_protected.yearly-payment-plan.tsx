// File: app/routes/YearlyPaymentPlan.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import {
  useCalculatePaymentPlan,
  SplitPayment,
} from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCompleteCheckout,
  CompleteCheckoutPayload,
} from "~/hooks/useCompleteCheckout";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";

export interface YearlyPaymentPlanProps {
  yearlyPowerAmount: string;
  superchargeDetails: { amount: string; paymentMethodId: string }[];
  otherUserAmounts: { userId: string; amount: string }[];
  selectedDiscounts?: string[];
}

const YearlyPaymentPlan: React.FC<Partial<YearlyPaymentPlanProps>> = (
  props
) => {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Merge incoming props over location.state
  const {
    yearlyPowerAmount = "0",
    superchargeDetails = [],
    otherUserAmounts = [],
    selectedDiscounts = [],
  } = {
    ...(state as Partial<YearlyPaymentPlanProps>),
    ...props,
  };

  // --- Hooks (always run in same order) ---
  const { data: userDetailsData, isLoading: userLoading } = useUserDetails();
  const { data: paymentMethodsData, status: pmStatus } = usePaymentMethods();
  const {
    mutate: calculatePlan,
    data: calculatedPlan,
    isPending: planLoading,
  } = useCalculatePaymentPlan();
  const { mutate: completeCheckout, status: checkoutStatus } =
    useCompleteCheckout();

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  // Show loader until we have the user
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="loader" />
      </div>
    );
  }

  // Safe defaults from userDetails
  const user = userDetailsData?.data?.user;
  const userYearlyPower = user?.yearlyPower || 0;
  const yearlyTerms = user?.yearlyTerms || 5; // in years

  const requestedFlex = parseFloat(yearlyPowerAmount) || 0;

  // Duration (months) options
  const computedMin =
    userYearlyPower > 0 && requestedFlex > 0
      ? Math.ceil((requestedFlex * 12) / (userYearlyPower / yearlyTerms))
      : 12;
  const minMonths = Math.max(12, computedMin);
  const maxMonths = yearlyTerms * 12;

  const monthOptions = useMemo(() => {
    const arr: number[] = [];
    for (let m = minMonths; m <= maxMonths; m++) arr.push(m);
    return arr;
  }, [minMonths, maxMonths]);

  const [selectedMonths, setSelectedMonths] = useState<number>(
    monthOptions[0] || 12
  );
  useEffect(() => {
    if (!monthOptions.includes(selectedMonths)) {
      setSelectedMonths(monthOptions[0] || 12);
    }
  }, [monthOptions, selectedMonths]);

  // Default payment method
  useEffect(() => {
    const cards =
      paymentMethodsData?.data?.data.filter((c) => c.type === "card") ?? [];
    if (cards.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cards[0]);
    }
  }, [paymentMethodsData, selectedPaymentMethod]);

  // Recalculate plan when inputs change
  const planRequest = useMemo(
    () => ({
      frequency: "MONTHLY" as const,
      numberOfPayments: selectedMonths,
      purchaseAmount: requestedFlex,
      startDate,
    }),
    [selectedMonths, requestedFlex, startDate]
  );
  useEffect(() => {
    if (requestedFlex > 0) {
      calculatePlan(planRequest, {
        onError: () => toast.error("Failed to calculate plan"),
      });
    }
  }, [planRequest, requestedFlex, calculatePlan]);

  // Map API splitPayments to UI format
  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments.map((p) => ({
      ...p,
      percentage: Number(
        ((p.amount / (requestedFlex || 1)) * 100).toFixed(2)
      ),
    })) || [];

  const handleMethodSelect = useCallback((card: PaymentMethod) => {
    setSelectedPaymentMethod(card);
    closeModal();
  }, []);

  const checkoutToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("checkoutToken")
      : "";

  const handleConfirm = () => {
    if (!selectedPaymentMethod || requestedFlex === 0) {
      toast.error("Select a card and ensure amount > 0");
      return;
    }
    if (!checkoutToken) {
      toast.error("Missing checkout token");
      return;
    }

    const payload: CompleteCheckoutPayload = {
      checkoutToken,
      instantAmount: 0,
      yearlyAmount: requestedFlex,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: superchargeDetails.map((d) => ({
        paymentMethodId: d.paymentMethodId,
        amount: parseFloat(d.amount),
      })),
      paymentFrequency: "MONTHLY",
      numberOfPayments: selectedMonths,
      offsetStartDate: startDate,
      otherUsers: otherUserAmounts.map((u) => ({
        userId: u.userId,
        amount: parseFloat(u.amount),
      })),
      discountIds: selectedDiscounts,
      selfPayActive: false,
    };

    completeCheckout(payload, {
      onSuccess: (data) => {
        const win = window.opener || window.parent || window;
        const status = otherUserAmounts.length ? "PENDING" : "COMPLETED";
        win.postMessage({ status, checkoutToken, data }, "*");
        toast.success("Payment plan confirmed!");
      },
      onError: () => toast.error("Checkout failed"),
    });
  };

  // compute filled percentage
  const fillPercent =
    ((selectedMonths - minMonths) / (maxMonths - minMonths)) * 100;

  return (
    <>
      {/* Global slider‐thumb styling */}
      <style>
        {`
        input[type="range"] {
          --thumb-size: 16px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: #00BFFF;
          border: none;
          cursor: pointer;
          margin-top: calc((8px - var(--thumb-size)) / 2);
        }
        input[type="range"]::-moz-range-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: #00BFFF;
          border: none;
          cursor: pointer;
        }
        input[type="range"]::-ms-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: #00BFFF;
          border: none;
          cursor: pointer;
        }
        `}
      </style>

      <div className="flex flex-col p-4 bg-white min-h-screen">
        {/* Updated header */}
        <h1 className="text-2xl font-bold mb-3">
          Flex your ${requestedFlex.toFixed(2)} on {selectedMonths}{" "}
          {selectedMonths === 1 ? "month" : "months"}
        </h1>

        {/* Slider */}
        <div className="mb-5">
        
          <input
            type="range"
            min={minMonths}
            max={maxMonths}
            value={selectedMonths}
            onChange={(e) => setSelectedMonths(+e.target.value)}
            style={{
              background: `linear-gradient(to right, #00BFFF 0%, #00BFFF ${fillPercent}%, #ccc ${fillPercent}%, #ccc 100%)`,
              height: 8,
              borderRadius: 4,
              appearance: "none",
            }}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-sm font-medium mt-1">
            <span>{minMonths} months</span>
            <span>{maxMonths} months</span>
          </div>
        </div>

        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
          {planLoading ? (
            <div className="flex justify-center">
              <div className="loader h-16 w-16" />
            </div>
          ) : (
            <PaymentPlanMocking
              payments={mockPayments}
              showChangeDateButton
              isCollapsed={false}
              initialDate={new Date(startDate)}
              onDateSelected={(d) =>
                setStartDate(d.toISOString().split("T")[0])
              }
            />
          )}
        </div>

        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">Payment Method</h2>
          {pmStatus === "pending" ? (
            <div className="flex justify-center">
              <div className="loader h-16 w-16" />
            </div>
          ) : (
            <SelectedPaymentMethod
              selectedMethod={selectedPaymentMethod}
              onPress={openModal}
            />
          )}
        </div>

        <button
          onClick={handleConfirm}
          disabled={checkoutStatus === "pending"}
          className={`w-full py-3 rounded-lg font-bold text-white ${
            checkoutStatus === "pending"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800"
          }`}
        >
          {checkoutStatus === "pending"
            ? "Processing…"
            : `Flex $${requestedFlex.toFixed(
                2
              )} over ${selectedMonths} ${
                selectedMonths === 1 ? "month" : "months"
              }`}
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeModal}
            />

            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full max-w-md bg-white rounded-t-lg shadow-lg max-h-[75vh] overflow-y-auto p-4">
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => navigate("/payment-settings")}
                    className="bg-black text-white px-4 py-2 rounded-lg"
                  >
                    Settings
                  </button>
                </div>
                {paymentMethodsData?.data?.data
                  .filter((c) => c.type === "card")
                  .map((card, idx) => (
                    <PaymentMethodItem
                      key={card.id}
                      method={card}
                      selectedMethod={selectedPaymentMethod}
                      onSelect={handleMethodSelect}
                      isLastItem={
                        idx === paymentMethodsData.data.data.length - 1
                      }
                    />
                  ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster richColors />
    </>
  );
};

export default YearlyPaymentPlan;
