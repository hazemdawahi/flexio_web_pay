// import React, { useState, useEffect, useCallback } from "react";
// import { useNavigate } from "@remix-run/react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   MdOutlineAccountBalance,
//   MdChevronRight,
//   MdCreditCard,
// } from "react-icons/md";
// import { IoIosArrowBack } from "react-icons/io"; // Back arrow icon added here
// import ProtectedRoute from "~/compoments/ProtectedRoute";
// import CardForm from "~/compoments/CardForm";
// import { usePlaidWebStripe } from "~/hooks/usePlaidWebStripe";
// import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
// import { Toaster, toast } from "sonner";
// import { getCardImage } from "~/utils/util";
// import PaymentMethodContent from "~/compoments/PaymentMethodContent";

// const PaymentSettingsContent: React.FC = () => {
//   const navigate = useNavigate();
//   const [iconColor] = useState("#000");

//   // React Sonner toast notifications
//   const triggerToast = useCallback(
//     (type: "success" | "error" | "info", message: string) => {
//       if (type === "success") {
//         toast.success(message);
//       } else if (type === "error") {
//         toast.error(message);
//       } else {
//         toast(message);
//       }
//     },
//     []
//   );

//   // Plaid hook for bank account linking
//   const { handleLinkProcess } = usePlaidWebStripe(triggerToast);

//   // State to handle bank linking loading
//   const [isBankLinking, setIsBankLinking] = useState(false);

//   // New function to handle bank account linking with loading state
//   const handleBankLink = async () => {
//     setIsBankLinking(true);
//     try {
//       await handleLinkProcess();
//     } catch (error) {
//       // Error is handled via triggerToast inside handleLinkProcess.
//     } finally {
//       setIsBankLinking(false);
//     }
//   };

//   // Fetch payment methods
//   const { data, isLoading } = usePaymentMethods();
//   const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

//   useEffect(() => {
//     if (data?.data?.data) {
//       setPaymentMethods(data.data.data);
//     }
//   }, [data]);

//   // Bottom sheet state for showing details or add card form
//   const [bottomSheetContent, setBottomSheetContent] = useState<
//     { type: string; detail?: any } | null
//   >(null);
//   const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

//   const openBottomSheet = (type: string, detail: any = null) => {
//     setBottomSheetContent({ type, detail });
//     setIsBottomSheetOpen(true);
//   };

//   const closeBottomSheet = () => {
//     setIsBottomSheetOpen(false);
//   };

//   const renderBottomSheetContent = () => {
//     const detail = bottomSheetContent?.detail;
//     switch (bottomSheetContent?.type) {
//       case "cardDetails":
//       case "bankDetails":
//         return (
//           <PaymentMethodContent
//             cardDetail={detail?.card}
//             bankDetail={detail?.usBankAccount}
//             cardLogo={detail?.card ? getCardImage(detail.card.brand) : undefined}
//             triggerToast={triggerToast}
//             handleClose={closeBottomSheet}
//             setPrimary={(id: string) => {
//               setPaymentMethods((methods) =>
//                 methods.map((method) =>
//                   method.id === id
//                     ? { ...method, primary: true }
//                     : { ...method, primary: false }
//                 )
//               );
//               closeBottomSheet();
//             }}
//             primary={
//               detail?.card
//                 ? detail.card.primary
//                 : detail?.usBankAccount?.primary
//             }
//             paymentMethodId={detail?.id}
//           />
//         );
//       case "addCard":
//         return (
//           <CardForm
//             onPaymentMethodCreated={(pm) => {
//               setPaymentMethods((prev) => [...prev, pm]);
//             }}
//             onClose={closeBottomSheet}
//           />
//         );
//       default:
//         return null;
//     }
//   };

//   const renderPaymentMethods = () =>
//     paymentMethods.map((method, index) => {
//       const isPrimary = method.card?.primary || method.usBankAccount?.primary;
//       return (
//         <div
//           key={method.id}
//           className={`flex justify-between items-center cursor-pointer px-5 py-4 ${
//             index < paymentMethods.length - 1 ? "border-b border-gray-300" : ""
//           }`}
//           onClick={() => {
//             openBottomSheet(
//               method.type === "card" ? "cardDetails" : "bankDetails",
//               method
//             );
//           }}
//         >
//           <div className="flex items-center">
//             {method.type === "card" && method.card && (
//               <img
//                 src={getCardImage(method.card.brand)}
//                 alt={method.card.brand}
//                 className="w-10 h-10 mr-3"
//               />
//             )}
//             {method.type === "us_bank_account" && method.usBankAccount && (
//               <MdOutlineAccountBalance
//                 size={40}
//                 style={{ color: iconColor }}
//               />
//             )}
//             <div>
//               <div className="flex items-center font-bold">
//                 <span>
//                   {method.type === "card"
//                     ? method.card?.brand.toUpperCase()
//                     : method.usBankAccount?.bank_name}
//                 </span>
//                 {isPrimary && <span className="ml-2">★</span>}
//               </div>
//               <div className="flex items-center">
//                 <span className="font-bold mr-1">....</span>
//                 <span className="font-bold">
//                   {method.type === "card"
//                     ? method.card?.last4
//                     : method.usBankAccount?.last4}
//                 </span>
//               </div>
//             </div>
//           </div>
//           <MdChevronRight size={24} style={{ color: iconColor }} />
//         </div>
//       );
//     });

//   if (isLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div>Loading...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-white p-5 relative">
//       {/* Header with Back Arrow */}
//       <header className="mb-5 flex items-center">
//         <button
//           onClick={() => navigate(-1)}
//           className="flex items-center text-gray-700 hover:text-gray-900"
//         >
//           <IoIosArrowBack className="mr-2" size={24} />
//           Back
//         </button>
//       </header>

//       {/* Top Section with Buttons */}
//       <div className="border border-gray-300 rounded-lg p-3 mb-5 flex flex-col">
//         <button
//           onClick={() => openBottomSheet("addCard")}
//           className="flex items-center text-lg font-semibold bg-transparent border-0 cursor-pointer py-3"
//         >
//           <MdCreditCard size={30} style={{ color: iconColor }} />
//           <span className="ml-3 text-black">Add Card</span>
//           <MdChevronRight
//             size={24}
//             className="ml-auto"
//             style={{ color: iconColor }}
//           />
//         </button>
//         <div className="h-px bg-gray-300 my-4" />
//         <button
//           onClick={handleBankLink}
//           className="flex items-center text-lg font-semibold bg-transparent border-0 cursor-pointer py-3"
//         >
//           <MdOutlineAccountBalance size={30} style={{ color: iconColor }} />
//           <span className="ml-3 text-black">Add Bank Account</span>
//           <MdChevronRight
//             size={24}
//             className="ml-auto"
//             style={{ color: iconColor }}
//           />
//         </button>
//       </div>

//       {/* Header */}
//       <h2 className="text-2xl font-bold mb-5">Your Linked Methods</h2>
//       <div className="overflow-y-auto">{renderPaymentMethods()}</div>

//       {/* Modal for Payment Method Selection */}
//       <AnimatePresence>
//         {isBottomSheetOpen && (
//           <>
//             {/* Backdrop for Bottom Sheet */}
//             <motion.div
//               className="fixed inset-0 bg-black bg-opacity-50 z-40"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 0.5 }}
//               exit={{ opacity: 0 }}
//               transition={{ duration: 0.3 }}
//               onClick={closeBottomSheet}
//             />
//             {/* Modal Container */}
//             <motion.div
//               className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
//               initial={{ y: "100%", opacity: 0 }}
//               animate={{ y: 0, opacity: 1 }}
//               exit={{ y: "100%", opacity: 0 }}
//               transition={{ duration: 0.3 }}
//             >
//               <motion.div
//                 className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-3/4 overflow-y-auto"
//                 initial={{ y: "100%", opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 exit={{ y: "100%", opacity: 0 }}
//                 transition={{ duration: 0.3 }}
//                 onClick={(e) => e.stopPropagation()}
//               >
//                 <div className="p-4">{renderBottomSheetContent()}</div>
//               </motion.div>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>

//       {/* Loading Backdrop for Bank Account Linking */}
//       <AnimatePresence>
//         {isBankLinking && (
//           <>
//             <motion.div
//               className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 0.7 }}
//               exit={{ opacity: 0 }}
//               transition={{ duration: 0.3 }}
//             >
//               {/* Simple Spinner */}
//               <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>

//       {/* React Sonner Toaster with a custom theme for richer colors */}
//       <Toaster richColors />
//     </div>
//   );
// };


// export default PaymentSettingsContent;
