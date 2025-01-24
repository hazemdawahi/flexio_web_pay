// app/components/CompactSelectedPaymentMethod.tsx
import React from "react";
import { PaymentMethod } from "~/hooks/usePaymentMethods";
import { getCardImage } from "~/utils/util";

interface CompactSelectedPaymentMethodProps {
  selectedMethod: PaymentMethod | null;
  onPress: () => void;
}

const CompactSelectedPaymentMethod: React.FC<CompactSelectedPaymentMethodProps> = ({
  selectedMethod,
  onPress,
}) => {
  return (
    <button onClick={onPress} className="flex items-center justify-center p-2 focus:outline-none">
      {selectedMethod ? (
        selectedMethod.type === "card" ? (
          <img
            src={getCardImage(selectedMethod.card?.brand || "")}
            alt="Selected Card"
            className="w-8 h-8"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-gray-600"
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
        )
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
};

export default CompactSelectedPaymentMethod;
