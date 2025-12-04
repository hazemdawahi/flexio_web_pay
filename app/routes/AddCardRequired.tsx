// import React from "react";
// import { useNavigate, useLocation } from "@remix-run/react";
// import { FiCreditCard } from "react-icons/fi";
// import { IoShieldCheckmarkOutline } from "react-icons/io5";
// import { HiOutlineLockClosed } from "react-icons/hi2";
// import { IoIosArrowBack } from "react-icons/io";

// const AddCardRequired: React.FC = () => {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const source = (location.state as { source?: string })?.source || "";

//   return (
//     <div className="min-h-screen flex flex-col bg-white p-3 sm:p-4 pt-12 sm:pt-16 lg:pt-20 font-sans">
//       {/* Header with Back (match UnifiedOptionsPage style) */}
//       <header className="w-full max-w-3xl mx-auto mb-6 sm:mb-8">
//         <div className="-mt-8 sm:-mt-10 lg:-mt-8">
//           <button
//             onClick={() => {
//               console.log("[AddCardRequired] Back clicked", { source });
//               navigate(-1);
//             }}
//             className="flex items-center text-gray-700 hover:text-gray-900 mb-8"
//             aria-label="Go back"
//           >
//             <IoIosArrowBack className="mr-2" size={22} />
//             <span className="text-base sm:text-lg">Back</span>
//           </button>
//         </div>

//         <h1 className="text-2xl sm:text-3xl font-bold text-left break-words">
//           No card payment method found
//         </h1>
//       </header>

//       {/* Content */}
//       <div className="w-full max-w-lg mx-auto px-6 py-10 text-center">
//         {/* Icons row */}
//         <div className="flex items-center justify-center gap-6 mb-6">
//           <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
//             <FiCreditCard className="text-2xl" />
//           </span>
//           <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
//             <IoShieldCheckmarkOutline className="text-2xl" />
//           </span>
//           <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
//             <HiOutlineLockClosed className="text-2xl" />
//           </span>
//         </div>

//         <p className="text-gray-700 text-lg font-medium mb-2">
//           You don’t have any card payment method.
//         </p>
//         <p className="text-gray-600 leading-relaxed">
//           Add or link a card in your account to continue.
//         </p>

//         {/* No routing actions here by request */}
//         {/* Just informational text and the back button above */}
//         <p className="text-xs text-gray-500 mt-8">
//           Your payment information is encrypted and securely processed.
//         </p>
//       </div>
//     </div>
//   );
// };

// export default AddCardRequired;
