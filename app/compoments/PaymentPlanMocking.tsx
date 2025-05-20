// src/components/PaymentPlanMocking.tsx

import React, { useState, useEffect, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

interface SplitPayment {
  amount: number;
  dueDate: string;
}

interface PaymentPlanMockingProps {
  payments?: SplitPayment[];
  isCollapsed: boolean;
  showEditButton?: boolean;
  showChangeDateButton?: boolean;
  onDateSelected?: (date: Date) => void;
  initialDate?: Date;
}

const ExampleCustomInput = forwardRef(
  (
    { onClick, className }: { onClick?: () => void; className?: string },
    ref: React.Ref<HTMLButtonElement>
  ) => (
    <button className={`${className} font-bold`} onClick={onClick} ref={ref}>
      Change Starting Date
    </button>
  )
);

const PaymentPlanMocking: React.FC<PaymentPlanMockingProps> = ({
  payments = [],
  isCollapsed,
  showEditButton = false,
  showChangeDateButton = false,
  onDateSelected,
  initialDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate || new Date()
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  if (isCollapsed) return null;

  // **NO** *100 here—sum API amounts directly
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleEditPress = () => {
    navigate("/payment-plans");
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      onDateSelected?.(date);
    }
  };

  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(today.getMonth() + 1);

  return (
    <div className="p-6 border rounded-lg bg-white shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-lg font-semibold">
          {payments.length} Total Payments
        </span>
        <div className="flex space-x-2">
          {showChangeDateButton && (
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              minDate={today}
              maxDate={maxDate}
              withPortal
              customInput={
                <ExampleCustomInput className="px-3 py-1 bg-[#00BFFF] text-white rounded transition-colors" />
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

      {/* Stepper */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-black" />
        <div className="ml-4">
          {payments.map((payment, index) => {
            const isLast = index === payments.length - 1;
            return (
              <div key={index} className="flex items-start mb-8">
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 bg-white border-2 border-black rounded-full z-10" />
                  {!isLast && <div className="w-px flex-1 bg-black" />}
                </div>
                <div className="ml-4">
                  <p className="text-md font-medium">
                    {new Date(payment.dueDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    ${payment.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex items-start mt-4">
            <div className="flex flex-col items-center">
              <div className="w-5 h-5 bg-white border-2 border-black rounded-full z-10" />
            </div>
            <div className="ml-4">
              <p className="text-md font-semibold">Total</p>
              <p className="text-sm text-gray-800">
                ${totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanMocking;
