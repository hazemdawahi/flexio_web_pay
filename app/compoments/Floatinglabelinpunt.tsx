import React, { useState, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'notched' | 'default';

interface FloatingLabelInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onBlur' | 'onFocus'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  editable?: boolean;
  borderStyle?: React.CSSProperties;
  onFocus?: () => void;
  onPress?: () => void;
  clickable?: boolean;
  nokeyboard?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  inputStyle?: React.CSSProperties;
  labelFontSize?: number;
  borderColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  variant?: Variant;
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  editable = true,
  borderStyle,
  onFocus,
  onPress,
  clickable = false,
  nokeyboard = false,
  type = 'text',
  multiline = false,
  numberOfLines = 1,
  inputStyle,
  labelFontSize = 16,
  borderColor = '#ccc',
  accentColor = '#ccc',
  backgroundColor = '#fff',
  variant = 'notched',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

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

  const isActive = isFocused || (value?.length ?? 0) > 0;
  const currentBorder = error ? 'red' : isFocused ? accentColor : borderColor;
  const isDisplayOnly = clickable && (!editable || nokeyboard);

  const content = (
    <>
      <div
        className="relative rounded-[10px] mb-2 overflow-visible"
        style={{
          height: multiline ? 100 : 61,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: currentBorder,
          backgroundColor,
          ...borderStyle,
        }}
      >
        {variant === 'notched' ? (
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
        ) : (
          <span
            className="absolute pointer-events-none transition-all duration-[160ms]"
            style={{
              left: 12,
              top: isActive ? -10 : 18,
              fontSize: labelFontSize,
              color: '#000',
            }}
          >
            {label}
          </span>
        )}

        {isDisplayOnly ? (
          <div
            className="text-base text-black px-3 rounded-lg font-normal"
            style={{ paddingTop: 18, paddingBottom: 12, lineHeight: '22px', ...inputStyle }}
          >
            {value || ''}
          </div>
        ) : multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={nokeyboard || !editable}
            rows={numberOfLines}
            className="w-full text-base text-black px-3 rounded-lg font-normal bg-transparent focus:outline-none resize-none"
            style={{ paddingTop: 8, paddingBottom: 8, lineHeight: '22px', height: '100%', ...inputStyle }}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={nokeyboard || !editable}
            className="w-full text-base text-black px-3 rounded-lg font-normal bg-transparent focus:outline-none"
            style={{ paddingTop: 18, paddingBottom: 12, lineHeight: '22px', ...inputStyle }}
            {...rest}
          />
        )}
      </div>
      {error && <div className="text-red-500 text-xs font-bold mt-1.5 mb-1.5">{`* ${error}`}</div>}
    </>
  );

  return clickable ? (
    <div onClick={handlePress} className="cursor-pointer">
      {content}
    </div>
  ) : (
    content
  );
};

export default FloatingLabelInput;