// src/components/PaymentPlanMocking.tsx

import React, { useState, useEffect, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";
import { IoCalendarOutline } from "react-icons/io5";

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

// Small icon-only button for react-datepicker (matches RN calendar icon affordance)
const IconInput = forwardRef<
  HTMLButtonElement,
  { onClick?: () => void; className?: string; title?: string }
>(({ onClick, className, title }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    title={title ?? "Change date"}
    className={`inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100 transition ${className ?? ""}`}
    aria-label="Change starting date"
  >
    <IoCalendarOutline size={22} color={BLUE} />
  </button>
));
IconInput.displayName = "IconInput";

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

  // Match RN’s line height approximation
  const lineHeightPx = 10 + payments.length * 32;

  return (
    <div className="pt-0.5 pb-3 px-5 rounded-lg bg-white my-2 shadow-md border">
      {/* Subheader row (like RN) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-[16px] font-semibold leading-[30px]">
            {payments.length} payments
          </span>

          {/* ⚡ Interest-free chip (only if enabled) */}
          {interestFreeEnabled && (
            <button
              type="button"
              onClick={onInterestFreePress}
              className="ml-3 h-[30px] px-3 rounded-[12px] font-bold"
              style={{ backgroundColor: "rgba(0,191,255,0.12)", color: BLUE }}
            >
              ⚡ ${Number(interestFreeUsed || 0)}
            </button>
          )}
        </div>

        <div className="flex items-center">
          {showChangeDateButton && (
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              minDate={today}
              maxDate={maxDate}
              withPortal
              customInput={<IconInput className="mr-3" />}
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

      {/* Schedule / timeline (match RN layout) */}
      <div className="relative mt-4">
        {/* Vertical line */}
        <div
          className="absolute"
          style={{
            backgroundColor: "rgba(0,191,255,0.35)",
            width: 2,
            top: 10,
            left: 5,
            height: lineHeightPx,
          }}
        />
        {/* Rows */}
        <div>
          {payments.map((payment, index) => (
            <div key={index} className="flex items-start mb-4 relative">
              {/* Dot */}
              <div
                className="absolute rounded-full border-2"
                style={{
                  width: 10,
                  height: 10,
                  left: 1,
                  top: 4,
                  borderColor: BLUE,
                  backgroundColor: "transparent",
                }}
              />
              {/* Date */}
              <div className="ml-5">
                <p className="text-[16px]">
                  {new Date(payment.dueDate).toDateString()}
                </p>
              </div>
              {/* Amount */}
              <p className="ml-auto mr-5 text-[16px] font-bold">
                ${Number(payment.amount ?? 0).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row (Interest / APR / Total) */}
      <div className="flex justify-around mt-4">
        <div className="flex flex-col items-center">
          <span className="text-[14px] text-[#555]">Interest</span>
          <span className="text-[16px] font-bold mt-1">
            {(Number(interestRate || 0) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[14px] text-[#555]">APR</span>
          <span className="text-[16px] font-bold mt-1">
            {(Number(apr || 0) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[14px] text-[#555]">Total</span>
          <span className="text-[16px] font-bold mt-1">
            ${Number(totalAmount).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanMocking;
