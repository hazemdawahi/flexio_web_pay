import React, { useState, InputHTMLAttributes } from "react";

interface FloatingLabelInputWithInstantProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onBlur' | 'onFocus'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  editable?: boolean;
  borderStyle?: React.CSSProperties;
  onFocus?: () => void;
  onPress?: () => void;
  nokeyboard?: boolean;
  instantPower?: number;
  keyboardType?: "text" | "number";
  powerType?: "instantaneous" | "yearly";
  labelFontSize?: number;
  borderColor?: string;
  backgroundColor?: string;
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

  const handlePress = () => {
    onPress?.();
    if (!nokeyboard) setIsFocused(true);
  };

  const formattedPower = instantPower !== undefined ? `$${instantPower.toFixed(2)}` : '';

  return (
    <div onClick={handlePress} className="cursor-pointer">
      <div
        className="w-full rounded-[10px] mb-4 overflow-visible shadow-md relative"
        style={{
          height: 61,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: error ? 'red' : borderColor,
          backgroundColor,
          ...borderStyle,
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

        <div className="flex flex-row items-center h-full pr-2">
          <div className="flex-1">
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
          </div>

          {instantPower !== undefined && (
            <div className="flex flex-row items-center ml-1">
              <div className="w-px bg-gray-300 h-9 mx-2.5" />
              <div className="flex flex-col items-center justify-center">
                <span className="text-base font-bold text-black">{formattedPower}</span>
                <span className="text-xs text-[#00BFFF] mt-0.5">
                  {powerType === "yearly" ? "Yearly Power" : "Instant Power"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-xs font-bold mt-1.5 mb-1.5">{`* ${error}`}</div>}
    </div>
  );
};

export default FloatingLabelInputWithInstant;