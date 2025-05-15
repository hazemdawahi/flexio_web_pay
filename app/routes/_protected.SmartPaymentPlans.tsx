// src/routes/_protected.SmartPaymentPlans.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";

import { usePlaidTokensStatus } from "~/hooks/usePlaidTokens";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSmartpayPlan, Cycle } from "~/hooks/useSmartpayPlan";
import {
  useFinancialCalendarPlan,
  IncomeEvent as HookIncomeEvent,
  LiabilityEvent as HookLiabilityEvent,
  PlanEvent as HookPlanEvent,
} from "~/hooks/useFinancialCalendarPlan";
import CustomCalendar from "~/compoments/CustomCalendar";
import FlipCard from "~/compoments/FlipCard";
import FlippedContent from "~/compoments/FlippedContent";
import PaymentCircle from "~/compoments/PaymentCircle";

interface SuperchargeDetail {
  amount: string;
  paymentMethodId: string;
}
interface SplitEntry {
  userId: string;
  amount: string;
}
interface SmartPaymentPlansProps {
  instantPowerAmount: string;
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
  superchargeDetails,
  otherUserAmounts,
  selectedDiscounts,
  paymentMethodId,
}) => {
  const navigate = useNavigate();
  const { search } = useLocation();

  // parse dollar amounts
  const displayedInstant = useMemo(() => {
    const n = parseFloat(instantPowerAmount);
    return isNaN(n) ? 0 : Number(n.toFixed(2));
  }, [instantPowerAmount]);

  const totalSupercharge = useMemo(() => {
    return superchargeDetails.reduce((sum, s) => {
      const v = parseFloat(s.amount);
      return sum + (isNaN(v) ? 0 : Number(v.toFixed(2)));
    }, 0);
  }, [superchargeDetails]);

  // only instantaneous amount drives the SmartPay plan, just like in PaymentPlan.tsx
  const purchaseAmount = displayedInstant;

  // fetch plan & calendar
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

  // plaid tokens status
  const {
    data: plaidTokensStatus,
    isLoading: plaidLoading,
    isError: plaidError,
  } = usePlaidTokensStatus();
  const hasRequiredPlaid = plaidTokensStatus?.data?.hasRequiredTokens === true;

  // user details
  const {
    data: userRes,
    isLoading: userLoading,
    isError: userError,
  } = useUserDetails();
  const smartPayEnabled = userRes?.data?.user.smartPay === true;

  // flip‐card rotation
  const [rotation, setRotation] = useState(0);
  const handleToggle = useCallback(() => {
    setRotation((r) => (r === 0 ? 180 : 0));
  }, []);

  // selected‐date details
  const [selectedDetails, setSelectedDetails] =
    useState<DateDetails | null>(null);

  const handleCalendarDateSelect = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

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
      calendarPlanData?.planEvents.filter(
        (evt) => evt.plannedPaymentDate === iso
      ) ?? [];
    const paymentPlanPayments = planRaw.map((evt) => ({
      dueDate: evt.plannedPaymentDate,
      amount: evt.allocatedPayment,
    }));

    const avoidedRange = (
      calendarPlanData?.avoidedDates ?? []
    ).find((r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
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

  // one‐time error toasts
  useEffect(() => {
    if (planError && planErrorObj) {
      toast.error(`Plan error: ${planErrorObj.message}`);
    }
    if (planCalendarError && planCalendarErrorObj) {
      toast.error(`Calendar error: ${planCalendarErrorObj.message}`);
    }
  }, [planError, planErrorObj, planCalendarError, planCalendarErrorObj]);

  // only non‐zero cycles
  const nonZeroCycles: Cycle[] =
    planData?.cycles.filter((c) => c.allocatedPayment !== 0) ?? [];

  // proceed URL
  const handleProceed = () => {
    const params = new URLSearchParams(search);
    params.set("instantPowerAmount", displayedInstant.toFixed(2));
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
    if (paymentMethodId) {
      params.set("paymentMethodId", paymentMethodId);
    }
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
          Please connect your bank (Plaid) before using Smart Payment Plans.
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
              month={d.toLocaleString("default", { month: "short" })}
              percentage={c.percentage}
              amount={c.allocatedPayment.toFixed(2)}
            />
          );
        })}
      </div>

      {/* Flip‐card container */}
      <div
        className="w-full max-w-2xl mx-auto mb-6 border border-gray-300 rounded overflow-hidden"
        style={{ height: "75vh" }}
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

      {/* Proceed button below calendar */}
      <div className="flex justify-center mb-12 px-4">
        <button
          onClick={handleProceed}
          className="w-full bg-black text-white font-bold py-3 rounded hover:bg-gray-800"
        >
          Proceed to Confirmation
        </button>
      </div>

      <Toaster richColors />
    </div>
  );
};

export default SmartPaymentPlans;
