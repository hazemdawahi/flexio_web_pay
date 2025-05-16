// src/routes/_protected.SmartPaymentPlans.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { usePlaidTokensStatus } from "~/hooks/usePlaidTokens";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSmartpayPlan, Cycle } from "~/hooks/useSmartpayPlan";
import {
  useFinancialCalendarPlan,
  IncomeEvent as HookIncomeEvent,
  LiabilityEvent as HookLiabilityEvent,
  PlanEvent as HookPlanEvent,
} from "~/hooks/useFinancialCalendarPlan";
import {
  usePaymentMethods,
  PaymentMethod,
} from "~/hooks/usePaymentMethods";
import CustomCalendar from "~/compoments/CustomCalendar";
import FlipCard from "~/compoments/FlipCard";
import FlippedContent from "~/compoments/FlippedContent";
import PaymentCircle from "~/compoments/PaymentCircle";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

interface SuperchargeDetail {
  amount: string;
  paymentMethodId: string;
}
interface SplitEntry {
  userId: string;
  amount: string;
}
interface SmartPaymentPlansProps {
  instantPowerAmount?: string;
  yearlyPowerAmount?: string;
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];
  paymentMethodId?: string;
}
interface PaymentDetail {
  dueDate: string;
  amount: number;
}
interface DateDetails {
  date: string;
  splitPayments: PaymentDetail[];
  incomeEvents: HookIncomeEvent[];
  liabilityEvents: HookLiabilityEvent[];
  paymentPlanPayments: PaymentDetail[];
  isAvoided: boolean;
  avoidedRangeName?: string;
  avoidedRangeId?: string;
}

const SmartPaymentPlans: React.FC<SmartPaymentPlansProps> = ({
  instantPowerAmount,
  yearlyPowerAmount,
  superchargeDetails,
  otherUserAmounts,
  selectedDiscounts,
  paymentMethodId,
}) => {
  const navigate = useNavigate();
  const { search } = useLocation();

  // pick whichever amount is provided
  const displayedAmount = useMemo(() => {
    const raw = yearlyPowerAmount != null ? yearlyPowerAmount : instantPowerAmount ?? "0";
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : Number(n.toFixed(2));
  }, [instantPowerAmount, yearlyPowerAmount]);

  const totalSupercharge = useMemo(() => {
    return superchargeDetails.reduce((sum, s) => {
      const v = parseFloat(s.amount);
      return sum + (isNaN(v) ? 0 : Number(v.toFixed(2)));
    }, 0);
  }, [superchargeDetails]);

  // use displayedAmount for all plan/calendar calls
  const purchaseAmount = displayedAmount;

  const {
    data: planData,
    isLoading: planLoading,
    isError: planError,
    error: planErrorObj,
  } = useSmartpayPlan(purchaseAmount);
  const {
    data: calendarPlanData,
    isLoading: planCalendarLoading,
    isError: planCalendarError,
    error: planCalendarErrorObj,
  } = useFinancialCalendarPlan(purchaseAmount);

  const {
    data: plaidTokensStatus,
    isLoading: plaidLoading,
    isError: plaidError,
  } = usePlaidTokensStatus();
  const hasRequiredPlaid =
    plaidTokensStatus?.data?.hasRequiredTokens === true;

  const {
    data: userRes,
    isLoading: userLoading,
    isError: userError,
  } = useUserDetails();
  const smartPayEnabled = userRes?.data?.user.smartPay === true;

  const {
    data: pmData,
    status: pmStatus,
  } = usePaymentMethods();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  // pick default on load
  useEffect(() => {
    const cards = pmData?.data?.data ?? [];
    if (!cards.length || selectedPaymentMethod) return;
    const firstCard = cards.find((m) => m.type === "card") ?? null;
    if (paymentMethodId) {
      const found = cards.find((m) => m.id === paymentMethodId) ?? firstCard;
      setSelectedPaymentMethod(found);
    } else {
      setSelectedPaymentMethod(firstCard);
    }
  }, [pmData, paymentMethodId, selectedPaymentMethod]);

  const [rotation, setRotation] = useState(0);
  const handleToggle = useCallback(() => {
    setRotation((r) => (r === 0 ? 180 : 0));
  }, []);

  const [selectedDetails, setSelectedDetails] =
    useState<DateDetails | null>(null);

  const handleCalendarDateSelect = (date: Date) => {
    const y = date.getFullYear(),
      m = String(date.getMonth() + 1).padStart(2, "0"),
      d = String(date.getDate()).padStart(2, "0"),
      iso = `${y}-${m}-${d}`;

    const splitRaw =
      calendarPlanData?.splitPayments.filter((p) => p.date === iso) ?? [];
    const splitPayments = splitRaw.map((p) => ({
      dueDate: p.date,
      amount: p.amount,
    }));

    const incomeEvents =
      calendarPlanData?.incomeEvents.filter((e) => e.date === iso) ?? [];
    const liabilityEvents =
      calendarPlanData?.liabilityEvents.filter((l) => l.date === iso) ?? [];

    const planRaw =
      calendarPlanData?.planEvents.filter((evt) => evt.plannedPaymentDate === iso) ?? [];
    const paymentPlanPayments = planRaw.map((evt) => ({
      dueDate: evt.plannedPaymentDate,
      amount: evt.allocatedPayment,
    }));

    const avoidedRange = (calendarPlanData?.avoidedDates ?? []).find((r) => {
      const start = new Date(r.startDate),
        end = new Date(r.endDate);
      return date >= start && date <= end;
    });

    setSelectedDetails({
      date: iso,
      splitPayments,
      incomeEvents,
      liabilityEvents,
      paymentPlanPayments,
      isAvoided: !!avoidedRange,
      avoidedRangeName: avoidedRange?.name,
      avoidedRangeId: avoidedRange?.id,
    });

    handleToggle();
  };

  useEffect(() => {
    if (planError && planErrorObj) {
      toast.error(`Plan error: ${planErrorObj.message}`);
    }
    if (planCalendarError && planCalendarErrorObj) {
      toast.error(`Calendar error: ${planCalendarErrorObj.message}`);
    }
  }, [
    planError,
    planErrorObj,
    planCalendarError,
    planCalendarErrorObj,
  ]);

  const nonZeroCycles: Cycle[] =
    planData?.cycles.filter((c) => c.allocatedPayment !== 0) ?? [];

  const handleProceed = () => {
    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }
    const params = new URLSearchParams(search);

    // set only the one that was provided
    if (yearlyPowerAmount != null) {
      params.set("yearlyPowerAmount", displayedAmount.toFixed(2));
    } else {
      params.set("instantPowerAmount", displayedAmount.toFixed(2));
    }

    params.set(
      "paymentPlan",
      JSON.stringify(
        nonZeroCycles.map((c) => ({
          cycleLabel: c.cycleLabel,
          plannedPaymentDate: c.plannedPaymentDate,
          allocatedPayment: c.allocatedPayment,
          percentage: c.percentage,
        }))
      )
    );
    params.set("superchargeDetails", JSON.stringify(superchargeDetails));
    params.set("otherUserAmounts", JSON.stringify(otherUserAmounts));
    params.set("selectedDiscounts", JSON.stringify(selectedDiscounts));
    params.set("paymentMethodId", selectedPaymentMethod.id);

    navigate(`/payment_confirmation?${params.toString()}`);
  };

  // loading & guards
  if (plaidLoading || userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader h-16 w-16" />
        <p className="mt-4">Loading account data…</p>
      </div>
    );
  }
  if (plaidError || !hasRequiredPlaid) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <p className="text-red-500 text-center">
          Please connect your bank (Plaid) before using Smart
          Payment Plans.
        </p>
      </div>
    );
  }
  if (userError || !smartPayEnabled) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <p className="text-red-500 text-center">
          Please enable Smart Pay in your account settings.
        </p>
      </div>
    );
  }
  if (planLoading || planCalendarLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="loader h-16 w-16" />
        <p className="mt-4">
          {planLoading
            ? "Calculating your payment plan…"
            : "Loading calendar data…"}
        </p>
      </div>
    );
  }
  if (planError || planCalendarError) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <p className="text-red-500 text-center">
          Failed to fetch data. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-y-auto p-4">
      {/* Summary */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Summary</h1>
        <p>
          <strong>Payments:</strong> {nonZeroCycles.length}
        </p>
        <p>
          <strong>Total:</strong> ${purchaseAmount.toFixed(2)}
        </p>
      </div>

      {/* Circles */}
      <div className="flex space-x-4 overflow-x-auto mb-6">
        {nonZeroCycles.map((c) => {
          const d = new Date(c.plannedPaymentDate);
          return (
            <PaymentCircle
              key={c.cycleLabel}
              day={d.getDate()}
              month={d.toLocaleString("default", {
                month: "short",
              })}
              percentage={c.percentage}
              amount={c.allocatedPayment.toFixed(2)}
            />
          );
        })}
      </div>

      {/* Flip-card container */}
      <div
        className="w-full max-w-2xl mx-auto mb-6 border border-gray-300 rounded overflow-hidden"
        style={{ height: "85vh" }}
      >
        <FlipCard
          rotation={rotation}
          frontContent={
            <CustomCalendar
              initialDate={new Date()}
              splitPayments={calendarPlanData?.splitPayments ?? []}
              incomeEvents={calendarPlanData?.incomeEvents ?? []}
              liabilityEvents={calendarPlanData?.liabilityEvents ?? []}
              avoidedDates={calendarPlanData?.avoidedDates ?? []}
              planEvents={calendarPlanData?.planEvents ?? []}
              renderSplitPayment={false}
              readonly
              onDateSelect={handleCalendarDateSelect}
            />
          }
          backContent={
            <div className="h-full overflow-auto p-4">
              <FlippedContent
                details={selectedDetails}
                onToggle={handleToggle}
                readonly
              />
            </div>
          }
        />
      </div>

      {/* Payment method selector */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Payment method
        </h2>
        {pmStatus === "pending" ? (
          <div className="flex justify-center">
            <div className="loader h-16 w-16" />
          </div>
        ) : pmStatus === "error" ? (
          <p className="text-red-500">
            Error fetching methods
          </p>
        ) : (
          <SelectedPaymentMethod
            selectedMethod={selectedPaymentMethod}
            onPress={() => setIsModalOpen(true)}
          />
        )}
      </div>

      {/* Proceed button below calendar */}
      <div className="flex justify-center mb-12 px-2">
        <button
          onClick={handleProceed}
          className="w-full bg-black text-white font-bold py-3 rounded hover:bg-gray-800"
        >
          Proceed to Confirmation
        </button>
      </div>

      {/* Payment method modal */}
      <AnimatePresence initial={false}>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
            >
              <motion.div
                className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-[75vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold">
                    Select payment method
                  </h3>
                  <button
                    onClick={() => navigate("/payment-settings")}
                    className="bg-black text-white px-3 py-1 rounded"
                  >
                    Settings
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {pmData?.data?.data
                    ?.filter((m) => m.type === "card")
                    .map((method) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={(m) => {
                          setSelectedPaymentMethod(m);
                          setIsModalOpen(false);
                        }}
                      />
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster richColors />
    </div>
  );
};

export default SmartPaymentPlans;
