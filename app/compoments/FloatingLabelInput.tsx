// // src/components/FloatingLabelInput.tsx

// import React, { useState, useEffect } from 'react';

// interface FloatingLabelInputProps {
//   label: string;
//   value: string;
//   onChangeText: (text: string) => void;
//   onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
//   error?: string;
//   editable?: boolean;
//   onFocus?: () => void;
//   onPress?: () => void;
//   clickable?: boolean; // Controls if the input is clickable
//   noKeyboard?: boolean; // If true, clicking does not focus the input
//   keyboardType?: string;
//   type?: string;
//   multiline?: boolean;
// }

// const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
//   label,
//   value,
//   onChangeText,
//   onBlur,
//   error,
//   editable = true,
//   onFocus,
//   onPress,
//   clickable = false,
//   noKeyboard = false,
//   keyboardType = 'text',
//   type = 'text',
//   multiline = false,
//   ...rest
// }) => {
//   const [isFocused, setIsFocused] = useState<boolean>(false);

//   // Handle focus state
//   const handleFocus = () => {
//     setIsFocused(true);
//     if (onFocus) {
//       onFocus();
//     }
//   };

//   const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
//     setIsFocused(false);
//     if (onBlur) {
//       onBlur(e);
//     }
//   };

//   const handlePress = () => {
//     if (onPress) {
//       onPress();
//     }
//     if (!noKeyboard) {
//       // Focus the input if possible
//       const input = document.getElementById(`floating-input-${label}`) as HTMLInputElement;
//       input?.focus();
//     }
//   };

//   const labelClass = `absolute left-4 transition-all duration-200 ${
//     isFocused || value ? 'text-xs -translate-y-4 text-blue-500' : 'text-gray-500'
//   }`;

//   const inputClass = `w-full px-4 py-2 border ${
//     error ? 'border-red-500' : 'border-gray-300'
//   } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
//     multiline ? 'h-24' : ''
//   }`;

//   const inputElement = (
//     <div className="relative">
//       <input
//         id={`floating-input-${label}`}
//         type={multiline ? 'text' : type}
//         value={value}
//         onChange={(e) => onChangeText(e.target.value)}
//         onFocus={handleFocus}
//         onBlur={handleBlur}
//         className={`${inputClass} ${multiline ? 'resize-none' : ''}`}
//         readOnly={!editable}
//         disabled={!editable}
//         {...rest}
//       />
//       <label className={labelClass}>{label}</label>
//     </div>
//   );

//   return (
//     <div className="w-full">
//       {clickable ? (
//         <button onClick={handlePress} className="w-full text-left">
//           {inputElement}
//         </button>
//       ) : (
//         inputElement
//       )}
//       {error && <p className="mt-1 text-red-500 text-sm">{error}</p>}
//     </div>
//   );
// };

// export default FloatingLabelInput;
