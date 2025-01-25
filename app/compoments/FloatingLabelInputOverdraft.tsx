// app/components/FloatingLabelInputOverdraft.tsx

import React, { useState, useEffect } from "react";
import CompactSelectedPaymentMethod from "./CompactSelectedPaymentMethod";
import { PaymentMethod } from "~/hooks/usePaymentMethods";

interface FloatingLabelInputOverdraftProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  editable?: boolean;
  onFocus?: () => void;
  nokeyboard?: boolean;
  selectedMethod: PaymentMethod | null;
  onPaymentMethodPress?: () => void;
  keyboardType?: "text" | "number";
  className?: string;
}

const FloatingLabelInputOverdraft: React.FC<FloatingLabelInputOverdraftProps> = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  editable = true,
  onFocus,
  nokeyboard = false,
  selectedMethod,
  onPaymentMethodPress,
  keyboardType = "text",
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [labelActive, setLabelActive] = useState(false);

  useEffect(() => {
    if (value) {
      setLabelActive(true);
    } else if (!isFocused) {
      setLabelActive(false);
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setLabelActive(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) setLabelActive(false);
    if (onBlur) onBlur();
  };

  return (
    <div className={`flex flex-row items-center w-full ${className || ''}`}>
      {/* Floating Label Input with integrated payment method selector */}
      <div
        className={`flex flex-row items-center flex-1 border ${
          error ? "border-red-500" : "border-gray-300"
        } rounded-lg shadow-md `}
      >
        {/* Input Container */}
        <div className="relative flex-1 border-r  rounded-l-lg p-2">
          <label
            className={`absolute left-2 transition-all duration-300 pointer-events-none ${
              labelActive
                ? "top-0 text-sm text-gray-700"
                : "top-2.5 text-base text-gray-500"
            }`}
          >
            {label}
          </label>
          <input
            type={keyboardType === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={!editable}
            className="w-full py-2 px-2 border-none focus:outline-none bg-transparent"
            style={{ caretColor: editable ? undefined : "transparent" }}
          />
        </div>

        {/* Compact Payment Method Selector */}
        <CompactSelectedPaymentMethod
          selectedMethod={selectedMethod}
          onPress={onPaymentMethodPress || (() => {})}
          error={error}
        />
      </div>
    </div>
  );
};

export default FloatingLabelInputOverdraft;
