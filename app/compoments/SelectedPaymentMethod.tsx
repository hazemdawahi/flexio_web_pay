// app/components/SelectedPaymentMethod.tsx
import React from 'react';
import { PaymentMethod } from '~/hooks/usePaymentMethods';
import { FaChevronDown } from 'react-icons/fa';
import { getCardImage } from '~/lib/utils';

interface SelectedPaymentMethodProps {
  selectedMethod: PaymentMethod | null;
  onPress: () => void;
}

const SelectedPaymentMethod: React.FC<SelectedPaymentMethodProps> = ({ selectedMethod, onPress }) => {
  const hasSelectedMethod = !!selectedMethod;

  return (
    <div
      className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
      onClick={onPress}
    >
      {/* Left icon / image */}
      {!hasSelectedMethod ? (
        // Empty / placeholder icon when no payment method is linked
        <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full mr-4">
          <span className="text-sm text-gray-600">–</span>
        </div>
      ) : selectedMethod.type === 'card' ? (
        <img
          src={getCardImage(selectedMethod.card?.brand || '')}
          alt={`${selectedMethod.card?.brand} logo`}
          className="w-12 h-12 object-contain mr-4"
        />
      ) : (
        <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full mr-4">
          {/* Bank Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.341A9 9 0 1112 21v-1m6-4a9 9 0 00-7.95-8.89"
            />
          </svg>
        </div>
      )}

      {/* Text content */}
      <div className="flex-1">
        {!hasSelectedMethod ? (
          <p className="text-md font-semibold text-gray-600">
            No payment method is linked
          </p>
        ) : selectedMethod.type === 'card' ? (
          <p className="text-md font-semibold">
            {selectedMethod.card?.brand} ****{selectedMethod.card?.last4}
          </p>
        ) : (
          <div>
            <p className="text-md font-semibold">
              {selectedMethod.usBankAccount?.bank_name}
            </p>
            <p className="text-sm text-gray-600">
              ****{selectedMethod.usBankAccount?.last4}
            </p>
          </div>
        )}
      </div>

      <FaChevronDown className="text-gray-500" />
    </div>
  );
};

export default SelectedPaymentMethod;
