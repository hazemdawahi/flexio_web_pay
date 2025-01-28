// src/pages/Plans.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react"; // Ensure correct import based on your routing library
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack } from "react-icons/io";
import SmartPaymentPlans from "~/routes/SmartPaymentPlans";
import PaymentPlan from "~/routes/PaymentPlan";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

export interface PlansData {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useSession(); // Assuming you have access to session

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const instantPowerAmount = searchParams.get("instantPowerAmount");
    const superchargeDetailsString = searchParams.get("superchargeDetails");
    const paymentMethodId = searchParams.get("paymentMethodId");

    if (instantPowerAmount && superchargeDetailsString && paymentMethodId) {
      try {
        const superchargeDetails: SuperchargeDetail[] = JSON.parse(superchargeDetailsString);
        const fetchedData: PlansData = {
          instantPowerAmount,
          superchargeDetails,
          paymentMethodId,
        };
        setData(fetchedData);
      } catch (error) {
        console.error("Error parsing superchargeDetails:", error);
        // Optionally, navigate back or display an error message to the user
        navigate("/error", { replace: true });
      }
    } else {
      console.warn("Missing required query parameters.");
      // Optionally, navigate back or display an error message to the user
      navigate("/error", { replace: true });
    }
  }, [location.search, navigate]);

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
      label: "Payment Plan",
      content: (
        <div className="px-4">
          <PaymentPlan
            instantPowerAmount={data.instantPowerAmount}
            superchargeDetails={data.superchargeDetails}
            paymentMethodId={data.paymentMethodId}
          />
        </div>
      ),
    },
    {
      label: "Smart Payment Plan",
      content: (
        <div className="px-4">
          <SmartPaymentPlans
            instantPowerAmount={data.instantPowerAmount}
            superchargeDetails={data.superchargeDetails}
            paymentMethodId={data.paymentMethodId}
          />
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

        {/* Tabs Section */}
        <div className="mt-4">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Plans;
