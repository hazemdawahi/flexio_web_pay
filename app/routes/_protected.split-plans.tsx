// // src/pages/SplitPlans.tsx

// import React, { useEffect, useState } from "react";
// import { useNavigate, useLocation } from "@remix-run/react"; // Ensure correct import based on your routing library
// import { useSession } from "~/context/SessionContext";
// import { IoIosArrowBack } from "react-icons/io";
// import SplitSmartPaymentPlan from "~/routes/_protected.SplitSmartPaymentPlan"; // Corrected import path
// import SplitPaymentPlan from "./_protected.split-payment-plan";
// import ProtectedRoute from "~/compoments/ProtectedRoute";
// import Tabs from "~/compoments/tabs";

// interface SuperchargeDetail {
//   amount: string; // amount in cents
//   paymentMethodId: string;
// }

// interface OtherUserAmount {
//   userId: string;
//   amount: string; // amount in cents
// }

// export interface PlansData {
//   instantPowerAmount: string; // in cents
//   superchargeDetails: SuperchargeDetail[];
//   otherUserAmounts: OtherUserAmount[];
//   paymentMethodId: string;
// }

// const SplitPlans: React.FC = () => {
//   const [data, setData] = useState<PlansData | null>(null);
//   const navigate = useNavigate();
//   const location = useLocation();
//   const { accessToken } = useSession(); // Assuming you have access to session

//   useEffect(() => {
//     const searchParams = new URLSearchParams(location.search);
//     const instantPowerAmount = searchParams.get("instantPowerAmount");
//     const superchargeDetailsString = searchParams.get("superchargeDetails");
//     const otherUserAmountsString = searchParams.get("otherUserAmounts");
//     const paymentMethodId = searchParams.get("paymentMethodId");

//     if (
//       instantPowerAmount &&
//       superchargeDetailsString &&
//       otherUserAmountsString &&
//       paymentMethodId
//     ) {
//       try {
//         const superchargeDetails: SuperchargeDetail[] = JSON.parse(superchargeDetailsString);
//         const otherUserAmounts: OtherUserAmount[] = JSON.parse(otherUserAmountsString);
//         const fetchedData: PlansData = {
//           instantPowerAmount,
//           superchargeDetails,
//           otherUserAmounts,
//           paymentMethodId,
//         };
//         setData(fetchedData);
//       } catch (error) {
//         console.error("Error parsing query parameters:", error);
//       }
//     } else {
//       console.warn("Missing required query parameters.");
//     }
//   }, [location.search, navigate]);

//   if (!data) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-white">
//         <p>Loading...</p>
//       </div>
//     );
//   }

//   // Define the tabs and their corresponding content
//   const tabs = [
//     {
//       label: "Split Payment Plan",
//       content: (
//         <div className="px-4">
//           <SplitPaymentPlan
//             instantPowerAmount={data.instantPowerAmount}
//             superchargeDetails={data.superchargeDetails}
//             otherUserAmounts={data.otherUserAmounts}
//             paymentMethodId={data.paymentMethodId}
//           />
//         </div>
//       ),
//     },
//     {
//       label: "Split Smart Payment Plan",
//       content: (
//         <div className="px-4">
//           <SplitSmartPaymentPlan
//             instantPowerAmount={data.instantPowerAmount}
//             superchargeDetails={data.superchargeDetails}
//             otherUserAmounts={data.otherUserAmounts}
//             paymentMethodId={data.paymentMethodId}
//           />
//         </div>
//       ),
//     },
//   ];

//   return (
//       <div className="min-h-screen bg-white">
//         {/* Header Section */}
//         <header className="flex items-center p-4">
//           {/* Back Button */}
//           <button
//             onClick={() => navigate(-1)}
//             className="flex items-center text-gray-700 hover:text-gray-900"
//           >
//             <IoIosArrowBack className="mr-2" size={24} />
//             Back
//           </button>
//         </header>

//         {/* Tabs Section */}
//         <div className="mt-4">
//           <Tabs tabs={tabs} />
//         </div>
//       </div>
//   );
// };

// export default SplitPlans;
