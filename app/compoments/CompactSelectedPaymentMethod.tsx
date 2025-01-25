// app/components/CompactSelectedPaymentMethod.tsx

import React from "react";
import { PaymentMethod } from "~/hooks/usePaymentMethods";
import { getCardImage } from "~/utils/util";

interface CompactSelectedPaymentMethodProps {
  selectedMethod: PaymentMethod | null;
  onPress: () => void;
  error?: string;
}

const CompactSelectedPaymentMethod: React.FC<CompactSelectedPaymentMethodProps> = ({
  selectedMethod,
  onPress,
  error,
}) => {
  const renderCardDetails = () => {
    if (!selectedMethod || selectedMethod.type !== "card") return null;

    const last4 = selectedMethod.card?.last4;
    if (!last4) return null;

    return (
      <span className="ml-2 text-gray-700 text-sm font-bold">
        ***{last4}
      </span>
    );
  };

  return (
    <button
      onClick={onPress}
      className={`flex items-center justify-center p-2 rounded-r-lg ${
        error ? "border-l border-red-500" : "border-l border-gray-300"
      } bg-white focus:outline-none`}
      style={{ minWidth: "4rem" }}
      aria-label="Select Payment Method"
    >
      {selectedMethod ? (
        selectedMethod.type === "card" ? (
          <div className="flex items-center justify-center">
            <img
              src={getCardImage(selectedMethod.card?.brand || "")}
              alt="Selected Card"
              className="w-6 h-6 object-contain"
            />
            {renderCardDetails()}
          </div>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
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
        )
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
};

export default CompactSelectedPaymentMethod;
