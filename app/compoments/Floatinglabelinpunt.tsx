import React, { useState, ChangeEvent } from 'react';

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  editable?: boolean;
  type?: string;
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  value,
  onChangeText,
  error,
  editable = true,
  type = 'text',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mb-4">
      <label
        className="absolute left-2 text-black bg-white px-1 transition-all ease-out"
        style={{
          top: isFocused || value ? '0px' : '18px',
          fontSize: isFocused || value ? '12px' : '16px',
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeText(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={!editable}
        className={`w-full pt-6 pb-1.5 px-2 text-base rounded-lg focus:outline-none ${
          error ? 'border border-red-500' : 'border border-gray-300'
        }`}
      />
      {error && (
        <div className="text-red-500 text-xs font-bold pb-2.5">
          {error}
        </div>
      )}
    </div>
  );
};

export default FloatingLabelInput;
