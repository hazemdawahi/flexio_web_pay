// // app/routes/payment_confirmation.tsx
// import React from 'react';
// import { useLocation } from 'react-router-dom';

// const PaymentConfirmation: React.FC = () => {
//   const location = useLocation();
//   const {
//     merchantId,
//     amount,
//     instantPowerAmount,
//     paymentPlan,
//     superchargeDetails,
//   } = location.state || {};

//   return (
//     <div className="p-4">
//       <h1 className="text-2xl font-bold mb-4">Payment Confirmation</h1>
//       {/* Display the confirmation details here */}
//       <p>Merchant ID: {merchantId}</p>
//       <p>Amount: ${amount}</p>
//       <p>Instant Power Amount: ${instantPowerAmount}</p>
//       {/* Add more details as needed */}
//     </div>
//   );
// };

// export default PaymentConfirmation;
