// FloatingLabelInputOverdraft.tsx
import React, { useState, InputHTMLAttributes } from "react";
import CompactSelectedPaymentMethod from "./CompactSelectedPaymentMethod";
import { PaymentMethod } from "~/hooks/usePaymentMethods";

interface FloatingLabelInputOverdraftProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onBlur' | 'onFocus'> {
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
  labelFontSize?: number;
  borderColor?: string;
  backgroundColor?: string;
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
  labelFontSize = 16,
  borderColor = "#ccc",
  backgroundColor = "#fff",
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const isActive = isFocused || (value?.length ?? 0) > 0;

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <div className="flex flex-row w-full h-[65px] items-stretch">
      <div
        className="flex-[0.4] h-full rounded-l-lg overflow-visible relative"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: error ? 'red' : borderColor,
          borderRightWidth: 0,
          backgroundColor,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          className="absolute px-1.5 pointer-events-none transition-all duration-[160ms]"
          style={{
            left: 10,
            top: isActive ? -10 : 18,
            backgroundColor,
          }}
        >
          <span style={{ fontSize: labelFontSize, color: '#000' }}>{label}</span>
        </div>

        <input
          type={keyboardType === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={nokeyboard || !editable}
          className="w-full text-base text-black px-3 rounded-lg font-normal bg-transparent focus:outline-hidden"
          style={{ paddingTop: 18, paddingBottom: 12, lineHeight: '22px' }}
          {...rest}
        />
        {error && <div className="text-red-500 text-xs font-bold pt-1 px-3">{error}</div>}
      </div>

      <div className="w-px bg-gray-300 h-full" />

      <CompactSelectedPaymentMethod
        selectedMethod={selectedMethod}
        onPress={onPaymentMethodPress || (() => {})}
      />
    </div>
  );
};

export default FloatingLabelInputOverdraft;