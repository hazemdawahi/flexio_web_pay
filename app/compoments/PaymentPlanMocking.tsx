// app/components/PaymentPlanMocking.tsx
import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useNavigate } from 'react-router-dom';

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
}

const PaymentPlanMocking: React.FC<PaymentPlanMockingProps> = ({
  payments = [],
  isCollapsed,
  showEditButton = false,
  showChangeDateButton = false,
  onDateSelected,
}) => {
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const navigate = useNavigate();

  if (isCollapsed) {
    return null;
  }

  // Calculate total amount
  const totalAmount = payments
    .reduce((total: number, payment: SplitPayment) => total + payment.amount, 0)
    .toFixed(2);

  const handleEditPress = () => {
    navigate('/payment-plans');
  };

  const handleDateChange = (date: Date | null) => {
    setDatePickerVisible(false);
    if (date) {
      setSelectedDate(date);
      onDateSelected && onDateSelected(date);
    }
  };

  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(today.getMonth() + 1);

  return (
    <div className="p-6 border rounded-lg bg-white shadow-md">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-lg font-semibold">{`${payments.length} Total Payments`}</span>
        <div className="flex space-x-2">
          {showChangeDateButton && (
            <button
              onClick={() => setDatePickerVisible(true)}
              className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              style={{ width: '120px', height: '40px' }}
            >
              Change Date
            </button>
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

      {/* Vertical Stepper */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-black"></div>

        {/* Payment Steps */}
        <div className="ml-4">
          {payments.map((payment, index) => {
            const isLast = index === payments.length - 1;
            return (
              <div key={index} className="flex items-start mb-8">
                {/* Dot and Connector */}
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 bg-white border-2 border-black rounded-full z-10"></div>
                  {!isLast && <div className="w-px flex-1 bg-black"></div>}
                </div>

                {/* Payment Details */}
                <div className="ml-4">
                  <p className="text-md font-medium">
                    {new Date(payment.dueDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">${(payment.amount / 100).toFixed(2)}</p>
                </div>
              </div>
            );
          })}

          {/* Total Amount */}
          <div className="flex items-start mt-4">
            {/* Dot */}
            <div className="flex flex-col items-center">
              <div className="w-5 h-5 bg-white border-2 border-black rounded-full z-10"></div>
            </div>

            {/* Total Details */}
            <div className="ml-4">
              <p className="text-md font-semibold">Total</p>
              <p className="text-sm text-gray-800">${(Number(totalAmount) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Picker */}
      {isDatePickerVisible && (
        <div className="mt-6">
          <DatePicker
            selected={selectedDate || today}
            onChange={handleDateChange}
            minDate={today}
            maxDate={maxDate}
            inline
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default PaymentPlanMocking;
