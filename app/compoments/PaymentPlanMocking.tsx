// src/components/PaymentPlanMocking.tsx

import React, { useState, useEffect, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────
// Types (aligned with RN)
// ─────────────────────────────────────────────────────────────
interface SplitPayment {
  amount: number;
  dueDate: string;
  originalAmount?: number;
  interestFreeSlice?: number;
  interestRate?: number;
  interestAmount?: number;
  originalInterestAmount?: number;
}

interface PaymentPlanMockingProps {
  payments?: SplitPayment[];
  totalAmount: number;                  // ✅ use prop (don’t re-sum)
  isCollapsed: boolean;

  // Date change
  showChangeDateButton?: boolean;
  onDateSelected?: (date: Date) => void;
  initialDate?: Date;

  // Interest-free chip
  interestFreeUsed?: number;
  interestFreeEnabled?: boolean;        // default true
  onInterestFreePress?: () => void;

  // Rates
  interestRate?: number;                // decimal, e.g. 0.0075
  apr?: number;                         // decimal, e.g. 0.18

  // Legacy (kept for compatibility with your older web usage)
  showEditButton?: boolean;
}

const BLUE = "#00BFFF";

// Custom input for react-datepicker with a button look (calendar icon-ish)
const ExampleCustomInput = forwardRef<
  HTMLButtonElement,
  { onClick?: () => void; className?: string }
>(({ onClick, className }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className={`${className ?? ""} flex items-center gap-2 font-bold px-3 py-1 rounded bg-[${BLUE}] text-white`}
    style={{ backgroundColor: BLUE }}
  >
    <span aria-hidden>📅</span>
    <span>Change Starting Date</span>
  </button>
));
ExampleCustomInput.displayName = "ExampleCustomInput";

// ─────────────────────────────────────────────────────────────

const PaymentPlanMocking: React.FC<PaymentPlanMockingProps> = ({
  payments = [],
  totalAmount,
  isCollapsed,

  // date change
  showChangeDateButton = false,
  onDateSelected,
  initialDate,

  // interest-free
  interestFreeUsed = 0,
  interestFreeEnabled = true,
  onInterestFreePress,

  // rates
  interestRate = 0,
  apr = 0,

  // legacy
  showEditButton = false,
}) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  if (isCollapsed) return null;

  const handleEditPress = () => navigate("/payment-plans");

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      onDateSelected?.(date);
    }
  };

  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setMonth(today.getMonth() + 1);

  // A soft approximation for the vertical line height
  const lineHeightPx = 10 + Math.max(0, payments.length) * 32;

  return (
    <div className="p-6 border rounded-lg bg-white shadow-md">
      {/* Header / Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">{payments.length} payments</span>

          {/* ⚡ Interest-free chip (only if enabled) */}
          {interestFreeEnabled && (
            <button
              type="button"
              onClick={onInterestFreePress}
              className="h-8 px-3 rounded-[12px] font-bold"
              style={{
                backgroundColor: "rgba(0,191,255,0.12)",
                color: BLUE,
              }}
            >
              ⚡ ${Number(interestFreeUsed || 0).toFixed(2)}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showChangeDateButton && (
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              minDate={today}
              maxDate={maxDate}
              withPortal
              customInput={
                <ExampleCustomInput className="transition-colors hover:opacity-90" />
              }
            />
          )}
          {showEditButton && (
            <button
              onClick={handleEditPress}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Edit Plan
            </button>
          )}
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="relative mt-4">
        <div
          className="absolute"
          style={{
            backgroundColor: "rgba(0,191,255,0.35)",
            width: 2,
            top: 10,
            left: 6,
            height: lineHeightPx,
          }}
        />
        <div className="ml-6">
          {payments.map((payment, index) => {
            const isLast = index === payments.length - 1;
            return (
              <div key={index} className="flex items-start mb-4 relative">
                {/* Dot */}
                <div
                  className="absolute rounded-full border-2"
                  style={{
                    width: 10,
                    height: 10,
                    left: -5,
                    top: 4,
                    borderColor: BLUE,
                    backgroundColor: "transparent",
                  }}
                />
                {/* Connector for all but last (the vertical line itself serves as connector) */}

                {/* Content */}
                <div className="flex-1 ml-2">
                  <p className="text-[15px] font-medium">
                    {new Date(payment.dueDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="ml-auto mr-4">
                  <p className="text-[15px] font-bold">
                    ${Number(payment.amount ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Footer Total (from prop) */}
          <div className="flex items-start mt-4 relative">
            <div
              className="absolute rounded-full border-2"
              style={{
                width: 10,
                height: 10,
                left: -5,
                top: 4,
                borderColor: BLUE,
                backgroundColor: "transparent",
              }}
            />
            <div className="ml-2">
              <p className="text-md font-semibold">Total</p>
              <p className="text-sm text-gray-800">${Number(totalAmount).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row (Interest / APR / Total) */}
      <div className="flex justify-around mt-5">
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-600">Interest</span>
          <span className="text-[16px] font-bold mt-1">
            {(Number(interestRate || 0) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-600">APR</span>
          <span className="text-[16px] font-bold mt-1">
            {(Number(apr || 0) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-[16px] font-bold mt-1">
            ${Number(totalAmount).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanMocking;
