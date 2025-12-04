// // app/routes/MerchantShoppingContent.tsx

// import React, { useEffect, useState, useCallback, useRef } from "react";
// import { useNavigate, useLocation } from "@remix-run/react";
// import { PaymentMethod, usePaymentMethods } from "~/hooks/usePaymentMethods";
// import { useUserDetails } from "~/hooks/useUserDetails";
// import { useSession } from "~/context/SessionContext";
// import { IoIosArrowBack } from "react-icons/io";
// import { motion, AnimatePresence } from "framer-motion";
// import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
// import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
// import PaymentMethodItem from "~/compoments/PaymentMethodItem";
// import ProtectedRoute from "~/compoments/ProtectedRoute";
// import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
// import { Toaster, toast } from "sonner";
// import { useAvailableDiscounts } from "~/hooks/useAvailableDiscounts";
// import { useMerchantDetail } from "~/hooks/useMerchantDetail";

// interface SplitEntry { userId: string; amount: string; }
// interface SuperchargeDetail { amount: string; paymentMethodId: string; }
// interface PlansData {
//   paymentType: "instantaneous" | "yearly" | "selfpay";
//   amount: string;
//   superchargeDetails: SuperchargeDetail[];
//   otherUserAmounts: SplitEntry[];
//   selectedDiscounts: string[];
//   paymentMethodId?: string;
// }

// interface LocationState { type?: "instantaneous" | "yearly"; }

// const MerchantShoppingContent: React.FC = () => {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const stateData = (location.state as LocationState) || {};
//   const paymentType = stateData.type || "instantaneous";
//   const isYearly = paymentType === "yearly";

//   const checkoutToken = sessionStorage.getItem("checkoutToken") || "";
//   const { accessToken } = useSession();

//   const {
//     data: paymentData,
//     isLoading: paymentLoading,
//     isError: isPaymentError,
//     error: paymentError,
//   } = usePaymentMethods();

//   const {
//     data: userData,
//     isLoading: isUserLoading,
//     isError: isUserError,
//     error: userError,
//   } = useUserDetails();

//   const {
//     data: checkoutData,
//     isLoading: checkoutLoading,
//     isError: isCheckoutError,
//     error: checkoutError,
//     status: checkoutStatus,
//   } = useCheckoutDetail(checkoutToken);

//   const checkoutTotalAmount = checkoutData
//     ? parseFloat(checkoutData.checkout.totalAmount.amount)
//     : 0;

//   const merchantId = checkoutData?.checkout.merchant.id || "";
//   const { data: merchantDetailData } = useMerchantDetail(merchantId);
//   const baseUrl = "http://localhost:8080";

//   const {
//     data: discounts = [],
//     isLoading: discountsLoading,
//     error: discountsError,
//   } = useAvailableDiscounts(merchantId, checkoutTotalAmount);

//   // --- form state ---
//   const [paymentAmount, setPaymentAmount] = useState("");
//   const [additionalFields, setAdditionalFields] = useState<string[]>([]);
//   const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<(PaymentMethod | null)[]>([]);
//   const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
//   const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);

//   // --- restore from history.state on mount ---
//   useEffect(() => {
//     const st = window.history.state || {};
//     if (st.merchantForm) {
//       const {
//         paymentAmount,
//         additionalFields,
//         selectedMethods,
//         selectedDiscounts,
//         selectedPaymentMethodId,
//       } = st.merchantForm as any;

//       setPaymentAmount(paymentAmount);
//       setAdditionalFields(additionalFields);
//       setSelectedDiscounts(selectedDiscounts);

//       if (paymentData) {
//         const all = paymentData.data.data;
//         setSelectedPaymentMethods(
//           selectedMethods.map((id: string | null) =>
//             id ? all.find(m => m.id === id) || null : null
//           )
//         );
//         setSelectedPaymentMethod(
//           all.find(m => m.id === selectedPaymentMethodId) || null
//         );
//       }
//     }
//   }, [paymentData]);

//   // --- prime default card on first load ---
//   useEffect(() => {
//     if (!selectedPaymentMethod && paymentData) {
//       const cards = paymentData.data.data.filter(m => m.type === "card");
//       if (cards.length) setSelectedPaymentMethod(cards[0]);
//     }
//   }, [paymentData, selectedPaymentMethod]);

//   // --- discount helpers ---
//   const getDiscountValue = (d: any): number =>
//     d.type === "PERCENTAGE_OFF"
//       ? checkoutTotalAmount * (d.discountPercentage / 100)
//       : d.discountAmount || 0;

//   const handleDiscountChange = (id: string | number) => {
//     const sid = String(id);
//     setSelectedDiscounts(prev => (prev.includes(sid) ? [] : [sid]));
//   };

//   const selectedDiscount = discounts.find(d =>
//     selectedDiscounts.includes(String(d.id))
//   );
//   const effectiveCheckoutTotal = selectedDiscount
//     ? Math.max(0, checkoutTotalAmount - getDiscountValue(selectedDiscount))
//     : checkoutTotalAmount;

//   // --- supercharge fields handlers ---
//   const addField = () => {
//     setAdditionalFields(prev => [...prev, ""]);
//     setSelectedPaymentMethods(prev => [...prev, selectedPaymentMethod]);
//   };

//   const updateField = (i: number, v: string) => {
//     setAdditionalFields(prev => {
//       const u = [...prev];
//       u[i] = v;
//       return u;
//     });
//   };

//   const openModal = (i: number) => {
//     setActiveFieldIndex(i);
//     setIsModalOpen(true);
//   };
//   const closeModal = () => setIsModalOpen(false);

//   const handleMethodSelect = useCallback((m: PaymentMethod) => {
//     if (activeFieldIndex != null) {
//       setSelectedPaymentMethods(prev => {
//         const u = [...prev];
//         u[activeFieldIndex] = m;
//         return u;
//       });
//     }
//     setIsModalOpen(false);
//   }, [activeFieldIndex]);

//   // --- navigation: stash form then go ---
//   const navigateToPlansPage = () => {
//     if (parseFloat(paymentAmount) <= 0) {
//       toast.error(`${isYearly ? "Yearly" : "Instant"} amount must be > 0.`);
//       return;
//     }

//     window.history.replaceState(
//       {
//         merchantForm: {
//           paymentAmount,
//           additionalFields,
//           selectedMethods: selectedPaymentMethods.map(m => m?.id || null),
//           selectedDiscounts,
//           selectedPaymentMethodId: selectedPaymentMethod?.id || null,
//         },
//       },
//       ""
//     );

//     const superchargeDetails: SuperchargeDetail[] = additionalFields.map((amt, idx) => ({
//       amount: parseFloat(amt).toFixed(2),
//       paymentMethodId: selectedPaymentMethods[idx]?.id || "",
//     }));

//     const stateForPlans: PlansData = {
//       paymentType,
//       amount: paymentAmount,
//       superchargeDetails,
//       otherUserAmounts: [],
//       selectedDiscounts,
//       paymentMethodId: selectedPaymentMethod?.id,
//     };

//     navigate("/plans", { state: stateForPlans });
//   };

//   // --- loading & error ---
//   const isLoading =
//     isUserLoading || paymentLoading || checkoutLoading || checkoutStatus === "pending";
//   const isErrorState =
//     isUserError || isPaymentError || isCheckoutError || !userData?.data;

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center h-screen">
//         <div className="loader" />
//       </div>
//     );
//   }
//   if (isErrorState) {
//     return (
//       <div className="flex items-center justify-center h-screen">
//         <p className="text-red-500">
//           {userError?.message || paymentError?.message || checkoutError?.message || "Failed to load."}
//         </p>
//       </div>
//     );
//   }

//   const cardPaymentMethods = paymentData?.data.data.filter(m => m.type === "card") || [];
//   const inputLabel = isYearly ? "Yearly Power Amount" : "Instant Power Amount";

//   return (
//     <ProtectedRoute>
//       <div className="min-h-screen bg-white p-4">
//         <div className="max-w-xl mx-auto">
//           <header className="mb-6 flex items-center">
//             <button
//               onClick={() => navigate(-1)}
//               className="flex items-center text-gray-700 hover:text-gray-900"
//             >
//               <IoIosArrowBack className="mr-2" size={24} />
//               Back
//             </button>
//           </header>

//           <h1 className="text-2xl font-bold mb-4">
//             Flex all of ${effectiveCheckoutTotal.toFixed(2)}
//           </h1>

//           <div className="mb-4">
//             <FloatingLabelInputWithInstant
//               label={inputLabel}
//               value={paymentAmount}
//               onChangeText={setPaymentAmount}
//               keyboardType="text"
//               instantPower={userData?.data?.user?.instantaneousPower ?? 0}
//               powerType={isYearly ? "yearly" : "instantaneous"}
//             />
//           </div>

//           {additionalFields.map((fld, i) => (
//             <div key={i} className="mb-4">
//               <FloatingLabelInputOverdraft
//                 label="Supercharge Amount"
//                 value={fld}
//                 onChangeText={v => updateField(i, v)}
//                 keyboardType="text"
//                 selectedMethod={selectedPaymentMethods[i] ?? null}
//                 onPaymentMethodPress={() => openModal(i)}
//               />
//             </div>
//           ))}

//           {/* Discounts Section */}
//           {(discountsLoading || discountsError || discounts.length > 0) && (
//             <div className="mb-4">
//               {discounts.length > 0 && (
//                 <h2 className="text-lg font-semibold mb-2">Available Discounts</h2>
//               )}
//               {discountsLoading ? (
//                 <p>Loading discounts…</p>
//               ) : discountsError ? (
//                 <p className="text-red-500">Error loading discounts</p>
//               ) : (
//                 <ul>
//                   {discounts.map((d: any) => {
//                     const disabled = checkoutTotalAmount - getDiscountValue(d) < 0;
//                     const sid = String(d.id);
//                     return (
//                       <li
//                         key={d.id}
//                         onClick={() => !disabled && handleDiscountChange(d.id)}
//                         className={`flex items-center justify-between border p-2 mb-2 rounded cursor-pointer ${
//                           disabled ? "opacity-50 cursor-not-allowed" : ""
//                         }`}
//                       >
//                         <div className="flex items-center">
//                           {merchantDetailData?.data?.brand?.displayLogo && (
//                             <img
//                               src={
//                                 merchantDetailData.data.brand.displayLogo.startsWith("http")
//                                   ? merchantDetailData.data.brand.displayLogo
//                                   : `${baseUrl}${merchantDetailData.data.brand.displayLogo}`
//                               }
//                               alt={merchantDetailData.data.brand.displayName ?? ""}
//                               className="w-10 h-10 rounded-full object-cover mr-4 border border-[#ccc]"
//                             />
//                           )}
//                           <div>
//                             <p className="font-bold">{d.discountName}</p>
//                             <p>
//                               {d.type === "PERCENTAGE_OFF"
//                                 ? `${d.discountPercentage}% off`
//                                 : `$${d.discountAmount.toFixed(2)} off`}
//                             </p>
//                             {d.expiresAt && (
//                               <p className="text-sm text-gray-500">
//                                 Expires: {new Date(d.expiresAt).toLocaleString()}
//                               </p>
//                             )}
//                           </div>
//                         </div>
//                         <input
//                           type="radio"
//                           name="discount"
//                           checked={selectedDiscounts.includes(sid)}
//                           disabled={disabled}
//                           readOnly
//                           className="ml-4 w-4 h-4 accent-blue-600"
//                         />
//                       </li>
//                     );
//                   })}
//                 </ul>
//               )}
//             </div>
//           )}

//           {/* Buttons */}
//           <div className="mt-6 flex space-x-4 mb-4">
//             <button
//               onClick={addField}
//               className="flex-1 bg-white border border-gray-300 text-black font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
//             >
//               Supercharge
//             </button>
//             <button
//               onClick={navigateToPlansPage}
//               className="flex-1 bg-black text-white py-4 px-4 rounded-lg font-bold hover:bg-gray-800 transition"
//             >
//               Flex your payments
//             </button>
//           </div>

//           <AnimatePresence>
//             {isModalOpen && (
//               <>
//                 <motion.div
//                   className="fixed inset-0 bg-black bg-opacity-50 z-40"
//                   initial={{ opacity: 0 }}
//                   animate={{ opacity: 0.5 }}
//                   exit={{ opacity: 0 }}
//                   transition={{ duration: 0.3 }}
//                   onClick={closeModal}
//                 />
//                 <motion.div
//                   className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
//                   initial={{ y: "100%", opacity: 0 }}
//                   animate={{ y: 0, opacity: 1 }}
//                   exit={{ y: "100%", opacity: 0 }}
//                   transition={{ duration: 0.3 }}
//                 >
//                   <motion.div
//                     className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-3/4 overflow-y-auto"
//                     initial={{ y: "100%", opacity: 0 }}
//                     animate={{ y: 0, opacity: 1 }}
//                     exit={{ y: "100%", opacity: 0 }}
//                     transition={{ duration: 0.3 }}
//                     onClick={e => e.stopPropagation()}
//                   >
//                     <div className="flex justify-end p-4">
//                       <button
//                         onClick={() => navigate("/payment-settings")}
//                         className="bg-black text-white font-bold py-2 px-4 rounded-lg"
//                       >
//                         Payment Settings
//                       </button>
//                     </div>
//                     <h2 className="px-4 mb-4 text-xl font-semibold">
//                       Select Payment Method
//                     </h2>
//                     <div className="space-y-4 px-4 pb-4">
//                       {cardPaymentMethods.map((method, idx) => (
//                         <PaymentMethodItem
//                           key={method.id}
//                           method={method}
//                           selectedMethod={selectedPaymentMethods[activeFieldIndex ?? 0] ?? null}
//                           onSelect={handleMethodSelect}
//                           isLastItem={idx === cardPaymentMethods.length - 1}
//                         />
//                       ))}
//                     </div>
//                   </motion.div>
//                 </motion.div>
//               </>
//             )}
//           </AnimatePresence>
//         </div>

//         <Toaster richColors position="top-right" />
//       </div>
//     </ProtectedRoute>
//   );
// };

// export default MerchantShoppingContent;
