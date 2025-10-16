// // src/components/PlanDetails.tsx
// import React from "react";

// const PlanDetails: React.FC = ({ data }) => {
//   return (
//     <div>
//       <div className="mb-4">
//         <h2 className="text-xl font-semibold">Merchant ID:</h2>
//         <p>{data.merchantId}</p>
//       </div>

//       <div className="mb-4">
//         <h2 className="text-xl font-semibold">Total Amount:</h2>
//         <p>${(parseFloat(data.amount) / 100).toFixed(2)}</p>
//       </div>

//       <div className="mb-4">
//         <h2 className="text-xl font-semibold">Instant Power Amount:</h2>
//         <p>${(parseFloat(data.instantPowerAmount) / 100).toFixed(2)}</p>
//       </div>

//       <div className="mb-4">
//         <h2 className="text-xl font-semibold">Supercharge Details:</h2>
//         {data.superchargeDetails.length > 0 ? (
//           <ul className="list-disc list-inside">
//             {data.superchargeDetails.map((detail, index) => (
//               <li key={index}>
//                 Supercharge Amount: $
//                 {(parseFloat(detail.amount) / 100).toFixed(2)} via Payment Method ID:{" "}
//                 {detail.paymentMethodId}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p>No supercharge details provided.</p>
//         )}
//       </div>

//       <div className="mb-6">
//         <h2 className="text-xl font-semibold">Selected Payment Method:</h2>
//         <p>{data.paymentMethodId}</p>
//       </div>
//     </div>
//   );
// };

// export default PlanDetails;
