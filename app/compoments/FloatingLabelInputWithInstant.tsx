import React, { useState, useEffect } from "react";

interface FloatingLabelInputWithInstantProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  editable?: boolean;
  onFocus?: () => void;
  borderStyle?: React.CSSProperties;
  onPress?: () => void;
  nokeyboard?: boolean;
  instantPower?: number;
  keyboardType?: "text" | "number";
  powerType?: "instantaneous" | "yearly";
}

const FloatingLabelInputWithInstant: React.FC<FloatingLabelInputWithInstantProps> = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  editable = true,
  borderStyle,
  onFocus,
  onPress,
  nokeyboard = false,
  instantPower,
  keyboardType = "text",
  powerType = "instantaneous",
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

  const handlePress = () => {
    if (onPress) onPress();
    if (!nokeyboard) {
      setIsFocused(true);
    }
  };

  // Removed any division/multiplication by 100
  const formatToDollars = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div onClick={handlePress} className="w-full">
      <div
        className={`flex flex-row items-center border ${
          error ? "border-red-500" : "border-gray-300"
        } rounded-lg shadow-md`}
        style={borderStyle}
      >
        {/* Input Container */}
        <div className="relative flex-1 border-r rounded-l-lg p-2">
          <label
            className={`absolute left-2 transition-all duration-300 pointer-events-none ${
              labelActive ? "top-0 text-sm text-gray-700" : "top-2.5 text-base text-gray-500"
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
            disabled={nokeyboard}
            className="w-full py-2 px-2 border-none focus:outline-none bg-transparent"
          />
        </div>

        {/* Power Section */}
        {instantPower !== undefined && (
          <div className="flex flex-col items-center justify-center p-2">
            <span className="text-sm font-bold">{formatToDollars(instantPower)}</span>
            <span className="text-xs text-gray-500">
              {powerType === "yearly" ? "Yearly Power" : "Instant Power"}
            </span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default FloatingLabelInputWithInstant;
