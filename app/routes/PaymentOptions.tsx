// // src/components/PaymentOptions.tsx
// import React from "react";

// interface PaymentOptionsProps {
//   onConfirm: () => void;
//   onCancel: () => void;
// }

// const PaymentOptions: React.FC<PaymentOptionsProps> = ({ onConfirm, onCancel }) => {
//   return (
//     <div>
//       {/* You can customize this section with actual payment options */}
//       <p>Select your preferred payment method and confirm your payment.</p>

//       {/* Action Buttons */}
//       <div className="flex space-x-4 mt-6">
//         <button
//           onClick={onConfirm}
//           className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition"
//         >
//           Confirm Payment
//         </button>
//         <button
//           onClick={onCancel}
//           className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition"
//         >
//           Cancel
//         </button>
//       </div>
//     </div>
//   );
// };

// export default PaymentOptions;
