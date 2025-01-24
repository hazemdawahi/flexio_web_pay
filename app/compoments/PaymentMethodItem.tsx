// app/components/PaymentMethodItem.tsx
import React from "react";
import { PaymentMethod } from "~/hooks/usePaymentMethods";
import { getCardImage } from "~/utils/util";

interface PaymentMethodItemProps {
  method: PaymentMethod;
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  GREEN_COLOR: string;
  isLastItem?: boolean;
}

const PaymentMethodItem: React.FC<PaymentMethodItemProps> = ({
  method,
  selectedMethod,
  onSelect,
  GREEN_COLOR,
  isLastItem = false,
}) => {
  const isSelected = selectedMethod?.id === method.id;

  return (
    <div
      className={`flex items-center p-4 cursor-pointer ${
        isSelected ? "bg-green-100" : "bg-white"
      } rounded-lg ${!isLastItem ? "border-b border-gray-200" : ""}`}
      onClick={() => onSelect(method)}
    >
      {method.type === "card" ? (
        <img
          src={getCardImage(method.card?.brand || "")}
          alt={`${method.card?.brand} logo`}
          className="w-10 h-10 mr-4"
        />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 mr-4 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 20h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      )}
      <div className="flex-1">
        {method.type === "card" ? (
          <p className="font-bold">{`${method.card?.brand} ****${method.card?.last4}`}</p>
        ) : (
          <div>
            <p className="font-bold">{method.usBankAccount?.bank_name}</p>
            <p className="text-sm text-gray-500">****{method.usBankAccount?.last4}</p>
          </div>
        )}
      </div>
      <input
        type="radio"
        checked={isSelected}
        onChange={() => onSelect(method)}
        className="form-radio h-5 w-5 text-green-500"
      />
    </div>
  );
};

export default PaymentMethodItem;
