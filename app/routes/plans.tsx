// src/pages/Plans.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack } from "react-icons/io";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";
import PaymentOptions from "./PaymentOptions";
import PlanDetails from "./PlanDetails";

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

export interface PlansData {
  merchantId: string;
  amount: string; // total amount in cents
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const { accessToken } = useSession(); // Assuming you have access to session

  // Simulate fetching data on mount (replace this with your own data-fetching logic)
  useEffect(() => {
    const fetchedData: PlansData = {
      merchantId: "123456",
      amount: "5000", // $50.00
      instantPowerAmount: "2000", // $20.00
      superchargeDetails: [
        { amount: "1000", paymentMethodId: "pm_1" },
        { amount: "2000", paymentMethodId: "pm_2" },
      ],
      paymentMethodId: "pm_main",
    };

    setData(fetchedData);
  }, []);

  const handleConfirm = () => {
    // Handle confirmation logic here, such as initiating a payment
    navigate("/payment-success");
  };

  const handleCancel = () => {
    // Handle cancellation logic, such as navigating back or resetting the state
    navigate("/merchant-shopping");
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p>Loading...</p>
      </div>
    );
  }

  // Define the tabs and their corresponding content
  const tabs = [
    {
      label: "Plan Details",
      content: (
        <div className="px-4">
          <PlanDetails data={data} />
        </div>
      ),
    },
    {
      label: "Payment Options",
      content: (
        <div className="px-4">
          <PaymentOptions onConfirm={handleConfirm} onCancel={handleCancel} />
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <header className="flex items-center p-4">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        {/* Add margin to move the tabs lower */}
        <div className="mt-4">
          {/* Tabs Component */}
          <Tabs tabs={tabs} />
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Plans;
